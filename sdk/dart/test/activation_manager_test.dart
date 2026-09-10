import 'package:test/test.dart';
import 'package:activation_manager_sdk/activation_manager.dart';

void main() {
  group('ActivationResult.parse', () {
    test('parses camelCase and snake_case dual fields', () {
      final result = ActivationResult.parse(
          '{\"success\":true,\"licenseMode\":\"COUNT\",\"license_mode\":\"COUNT\",\"remainingCount\":9,\"valid\":true}');
      expect(result.success, isTrue);
      expect(result.licenseMode, 'COUNT');
      expect(result.remainingCount, 9);
      expect(result.valid, isTrue);
    });

    test('business failure passes through', () {
      final result = ActivationResult.parse(
          '{\"success\":false,\"message\":\"code not found\"}');
      expect(result.success, isFalse);
      expect(result.message, 'code not found');
    });

    test('throws on non-JSON body', () {
      expect(() => ActivationResult.parse('not-json'),
          throwsFormatException);
    });
  });

  group('client exception codes', () {
    test('kind codes map to contract', () {
      expect(
          ActivationClientException(ActivationErrorKind.networkError, 'x')
              .kindCode,
          'NETWORK_ERROR');
      expect(
          ActivationClientException(ActivationErrorKind.timeout, 'x').kindCode,
          'TIMEOUT');
      expect(
          ActivationClientException(ActivationErrorKind.signatureInvalid, 'x')
              .kindCode,
          'SIGNATURE_INVALID');
    });
  });
}
