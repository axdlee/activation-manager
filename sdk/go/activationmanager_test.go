package activationmanager

import (
	"strconv"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const testSecret = "test-secret"

func startServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(handler)
}

func sign(t *testing.T, body []byte) (string, string) {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(testSecret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil)), time.Now().Format("2006-01-02T15:04:05")
}

func TestActivateSuccess(t *testing.T) {
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		var input map[string]any
		_ = json.NewDecoder(r.Body).Decode(&input)
		if input["projectKey"] != "demo" {
			t.Errorf("projectKey = %v", input["projectKey"])
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true, "licenseMode": "COUNT", "license_mode": "COUNT",
			"remainingCount": 9, "remaining_count": 9, "valid": true,
		})
	})
	defer server.Close()

	client := NewClient(ClientOptions{BaseURL: server.URL, ProjectKey: "demo"})
	result, err := client.Activate(context.Background(), "CODE-1", "m-1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Success || result.EffectiveLicenseMode() != "COUNT" {
		t.Fatalf("unexpected result: %+v", result)
	}
	if *result.EffectiveRemainingCount() != 9 {
		t.Fatalf("remaining = %v", result.EffectiveRemainingCount())
	}
}

func TestBusinessFailurePassthrough(t *testing.T) {
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":false,"message":"激活码不存在"}`))
	})
	defer server.Close()

	client := NewClient(ClientOptions{BaseURL: server.URL})
	result, err := client.Status(context.Background(), "BAD", "m-1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if result.Success || result.Message != "激活码不存在" {
		t.Fatalf("unexpected: %+v", result)
	}
}

func TestConsumeNoRetryWithoutRequestID(t *testing.T) {
	calls := 0
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusInternalServerError)
	})
	defer server.Close()

	client := NewClient(ClientOptions{BaseURL: server.URL, MaxRetries: 3, RetryDelayMS: 1})
	_, err := client.Consume(context.Background(), "C", "m", nil, nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if calls != 1 {
		t.Fatalf("expected 1 call without requestID, got %d", calls)
	}
}

func TestConsumeRetryWithRequestID(t *testing.T) {
	calls := 0
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"remainingCount":8}`))
	})
	defer server.Close()

	client := NewClient(ClientOptions{BaseURL: server.URL, MaxRetries: 3, RetryDelayMS: 1})
	rid := "req-1"
	result, err := client.Consume(context.Background(), "C", "m", &rid, nil)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 calls, got %d", calls)
	}
	if !result.Success {
		t.Fatalf("unexpected: %+v", result)
	}
}

func TestSignatureVerification(t *testing.T) {
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		body := []byte(`{"success":true,"licenseMode":"TIME","license_mode":"TIME"}`)
		mac := hmac.New(sha256.New, []byte(testSecret))
		mac.Write(body)
		sig := hex.EncodeToString(mac.Sum(nil))
		ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
		w.Header().Set(SignatureHeader, sig)
		w.Header().Set(TimestampHeader, ts)
		_, _ = w.Write(body)
	})
	defer server.Close()

	good := NewClient(ClientOptions{BaseURL: server.URL, ResponseSecret: testSecret})
	if _, err := good.Status(context.Background(), "C", "m", nil); err != nil {
		t.Fatalf("valid signature should pass: %v", err)
	}

	bad := NewClient(ClientOptions{BaseURL: server.URL, ResponseSecret: "wrong"})
	_, err := bad.Status(context.Background(), "C", "m", nil)
	if err == nil || !strings.Contains(err.Error(), "SIGNATURE") {
		t.Fatalf("expected signature error, got %v", err)
	}
}

func TestTimeout(t *testing.T) {
	server := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
	})
	defer server.Close()

	client := NewClient(ClientOptions{BaseURL: server.URL, Timeout: 50 * time.Millisecond})
	_, err := client.Status(context.Background(), "C", "m", nil)
	if err == nil || err.(*ClientError).Kind != ErrTimeout {
		t.Fatalf("expected timeout, got %v", err)
	}
}
