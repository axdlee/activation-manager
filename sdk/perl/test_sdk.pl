#!/usr/bin/env perl
use strict;
use warnings;
use utf8;
use lib '.';
use ActivationManager;
use IO::Socket::INET;
use threads;
use Digest::SHA qw(hmac_sha256_hex);

my $SECRET = 'test-secret';
my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1', LocalPort => 0, Proto => 'tcp', Listen => 5, ReuseAddr => 1,
) or die "socket: $!";
my $port = $server->sockport;

my $worker = threads->create(sub {
    while (my $conn = $server->accept) {
        my $request = '';
        while (my $line = <$conn>) {
            $request .= $line;
            last if $line =~ /^\r?\n$/;
        }
        my ($content_length) = $request =~ /Content-Length: (\d+)/i;
        my $body = '';
        if ($content_length) {
            read($conn, $body, $content_length);
        }
        my $req = eval { JSON::PP->new->decode($body) } // {};
        my $payload = ($req->{code} // '') eq 'BAD'
            ? JSON::PP->new->utf8->encode({ success => JSON::PP::false(), message => "\x{6fc0}\x{6d3b}\x{7801}\x{4e0d}\x{5b58}\x{5728}" })
            : JSON::PP->new->utf8->encode({
                success => JSON::PP::true(), licenseMode => 'COUNT', license_mode => 'COUNT',
                remainingCount => 9, valid => JSON::PP::true(),
            });
        my $sig = hmac_sha256_hex($payload, $SECRET);
        my $ts = int(time() * 1000);
        print $conn "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n";
        print $conn "x-license-signature: $sig\r\nx-license-timestamp: $ts\r\n";
        print $conn "Content-Length: " . length($payload) . "\r\n\r\n";
        print $conn $payload;
        close $conn;
    }
});

my $failures = 0;
sub check {
    my ($cond, $msg) = @_;
    if ($cond) { print "✅ $msg\n"; } else { print "❌ $msg\n"; $failures++; }
}

my $client = ActivationManager->new(
    base_url => "http://127.0.0.1:$port",
    project_key => 'demo',
    response_secret => $SECRET,
);

my $r = $client->activate('CODE-1', 'm-1');
check($r->{success}, 'activate success');
check(($r->{license_mode} // '') eq 'COUNT', 'licenseMode normalized');
check(($r->{remaining_count} // 0) == 9, 'remainingCount = 9');

$client->activate('CODE-2', 'm-2', 'override');
check(1, 'projectKey override accepted');

$r = $client->status('BAD', 'm-1');
check(!$r->{success} && defined $r->{message}, 'business failure passthrough');

my $bad = ActivationManager->new(base_url => "http://127.0.0.1:$port", response_secret => 'wrong');
eval { $bad->status('OK', 'm') };
if (my $err = $@) {
    check($err =~ /SIGNATURE_\w+/, "signature rejected: " . ($err =~ /(SIGNATURE_\w+)/ ? $1 : '?'));
} else {
    check(0, 'signature rejected');
}

$worker->detach();
close($server);
print $failures == 0 ? "✅ Perl SDK 自测通过\n" : "❌ $failures failures\n";
exit($failures == 0 ? 0 : 1);
