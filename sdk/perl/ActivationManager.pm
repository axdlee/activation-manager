# ActivationManager License API SDK (Perl 5.14+)
#
# 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Perl 实现：
#  - activate / status / consume 三个正式接口
#  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
#  - 可选 project_key 默认值，单次调用可覆盖
#  - 超时 / 重试（仅瞬时网络错误；consume 建议配 request_id 保证幂等）
#  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗，Digest::SHA 内建 hmac_sha256_hex）
#
# 仅依赖 Perl 核心模块：HTTP::Tiny（5.14+）、JSON::PP（5.14+）、Digest::SHA（5.9.3+）。
# 用法：
#   my $client = ActivationManager->new(
#       base_url => 'http://127.0.0.1:3000', project_key => 'browser-plugin');
#   my $result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
#   print "激活失败: $result->{message}\n" unless $result->{success};

package ActivationManager;
use strict;
use warnings;
use utf8;

use HTTP::Tiny;
use JSON::PP;
use Digest::SHA qw(hmac_sha256_hex);
use Time::HiRes qw(time sleep);
use Carp qw(croak);

our $VERSION = '1.0.0';

use constant {
    SIGNATURE_HEADER     => 'x-license-signature',
    TIMESTAMP_HEADER     => 'x-license-timestamp',
    SIGNATURE_MAX_AGE_MS => 5 * 60 * 1000,
};

sub new {
    my ($class, %args) = @_;
    my $self = bless {}, $class;
    my $base = $args{base_url} // 'http://127.0.0.1:3000';
    $base =~ s{/+$}{};
    $self->{base_url} = $base;
    $self->{project_key} = $args{project_key} // 'default';
    $self->{timeout_seconds} = $args{timeout_seconds} // 10;
    $self->{max_retries} = $args{max_retries} // 0;
    $self->{retry_delay_seconds} = $args{retry_delay_seconds} // 0.2;
    $self->{headers} = $args{headers} // {};
    $self->{response_secret} = $args{response_secret} // '';
    return $self;
}

# 错误：网络异常/超时/签名失败时 die 一个带 kind 的对象；业务失败看 {success}。
sub _error {
    my ($kind, $message, %extra) = @_;
    die ActivationManagerError->new(
        kind => $kind, message => $message,
        path => $extra{path} // '', attempt_count => $extra{attempt_count} // 1,
    );
}

{
    package ActivationManagerError;
    use overload '""' => sub { sprintf '%s: %s (path=%s, attempt=%d)', $_[0]->{kind}, $_[0]->{message}, $_[0]->{path}, $_[0]->{attempt_count} };
    sub new { my ($c, %a) = @_; return bless { kind => $a{kind}, message => $a{message}, path => $a{path}, attempt_count => $a{attempt_count} }, $c; }
    sub kind { $_[0]->{kind} }
}

sub activate {
    my ($self, $code, $machine_id, $project_key) = @_;
    return $self->_call('/api/license/activate', $code, $machine_id, undef, $project_key, 1);
}

sub status {
    my ($self, $code, $machine_id, $project_key) = @_;
    return $self->_call('/api/license/status', $code, $machine_id, undef, $project_key, 1);
}

sub consume {
    my ($self, $code, $machine_id, $request_id, $project_key) = @_;
    my $allow_retry = defined $request_id && $request_id ne '';
    return $self->_call('/api/license/consume', $code, $machine_id, $request_id, $project_key, $allow_retry);
}

sub _call {
    my ($self, $path, $code, $machine_id, $request_id, $project_key, $allow_retry) = @_;

    my $payload = {
        code       => $code,
        machineId  => $machine_id,
        projectKey => (defined $project_key && length $project_key) ? $project_key : $self->{project_key},
    };
    $payload->{requestId} = $request_id if defined $request_id && length $request_id;

    my $body = JSON::PP->new->utf8->canonical->encode($payload);
    my $total_attempts = ($allow_retry && $self->{max_retries} > 0) ? $self->{max_retries} + 1 : 1;

    my $last_error;
    for my $attempt (1 .. $total_attempts) {
        my ($ok, $result_or_error) = $self->_attempt($path, $body, $attempt);
        return $result_or_error if $ok;
        $last_error = $result_or_error;
        sleep($self->{retry_delay_seconds}) if $attempt < $total_attempts;
    }
    croak $last_error;
}

sub _attempt {
    my ($self, $path, $body, $attempt) = @_;

    my $http = HTTP::Tiny->new(timeout => $self->{timeout_seconds});
    my $response = $http->post(
        $self->{base_url} . $path,
        {
            headers => { 'Content-Type' => 'application/json', %{$self->{headers}} },
            content => $body,
        },
    );

    if (!$response->{success}) {
        my $kind = $response->{status} == 599 ? 'TIMEOUT' : 'NETWORK_ERROR';
        # HTTP::Tiny 599 = 内部超时/连接错误；带 JSON body 的业务失败走 success 分支
        if ($response->{status} != 599 && defined $response->{content} && $response->{content} =~ /"success"/) {
            # 继续解析（服务端 4xx 业务响应）
        } else {
            return (0, _error($kind, $response->{reason} // 'request failed', path => $path, attempt_count => $attempt));
        }
    }

    my $raw = $response->{content};

    if (length $self->{response_secret}) {
        my $sig = $response->{headers}{'x-license-signature'} // '';
        my $ts  = $response->{headers}{'x-license-timestamp'} // '';
        $sig = (ref $sig ? $sig->[0] : $sig) // '';
        $ts  = (ref $ts  ? $ts->[0]  : $ts)  // '';
        _error('SIGNATURE_MISSING', 'missing signature headers') if !length($sig) || !length($ts);
        _error('SIGNATURE_INVALID', 'invalid signature timestamp') if $ts !~ /^\d+$/;
        my $now_ms = int(time * 1000);
        _error('SIGNATURE_EXPIRED', 'signature timestamp outside window') if abs($now_ms - $ts) > SIGNATURE_MAX_AGE_MS;
        my $expected = hmac_sha256_hex($raw, $self->{response_secret});
        _error('SIGNATURE_INVALID', 'response signature mismatch') unless $expected eq $sig;
    }

    my $parsed = eval { JSON::PP->new->decode($raw) };
    _error('INVALID_RESPONSE', 'response is not a JSON object', path => $path, attempt_count => $attempt) if !$parsed || ref $parsed ne 'HASH';

    if (($response->{status} // 200) >= 400 && !exists $parsed->{success}) {
        _error('HTTP_ERROR', 'HTTP ' . ($response->{status} // '?'), path => $path, attempt_count => $attempt);
    }

    # 双字段归一：camelCase 优先
    $parsed->{license_mode}    = $parsed->{licenseMode}    // $parsed->{license_mode};
    $parsed->{expires_at}      = $parsed->{expiresAt}      // $parsed->{expires_at};
    $parsed->{remaining_count} = $parsed->{remainingCount} // $parsed->{remaining_count};
    $parsed->{is_activated}    = $parsed->{isActivated}    // $parsed->{is_activated};

    return (1, $parsed);
}

1;

__END__

=head1 NAME

ActivationManager — Activation Manager License API SDK (Perl)

=head1 SYNOPSIS

    use ActivationManager;

    my $client = ActivationManager->new(
        base_url    => 'http://127.0.0.1:3000',
        project_key => 'browser-plugin',
    );

    my $result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
    print "激活失败: $result->{message}\n" unless $result->{success};
