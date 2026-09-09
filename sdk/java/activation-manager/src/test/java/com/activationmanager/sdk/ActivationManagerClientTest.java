package com.activationmanager.sdk;

import com.activationmanager.sdk.ActivationManagerClient.Result;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ActivationManagerClientTest {

    private HttpServer start(com.sun.net.httpserver.HttpHandler handler) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> handler.handle(exchange));
        server.start();
        return server;
    }

    @Test
    void activateSuccess() throws Exception {
        HttpServer server = start(exchange -> {
            byte[] body = "{\"success\":true,\"licenseMode\":\"COUNT\",\"remainingCount\":9,\"valid\":true}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });
        ActivationManagerClient.ClientOptions opts = new ActivationManagerClient.ClientOptions();
        opts.baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        opts.projectKey = "demo";
        ActivationManagerClient client = new ActivationManagerClient(opts);
        Result r = client.activate("CODE-1", "m-1");
        server.stop(0);
        assertTrue(r.isSuccess());
        assertEquals("COUNT", r.getLicenseMode());
        assertEquals(9L, r.getRemainingCount().orElse(-1L));
    }

    @Test
    void businessFailurePassthrough() throws Exception {
        HttpServer server = start(exchange -> {
            byte[] body = "{\"success\":false,\"message\":\"激活码不存在\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });
        ActivationManagerClient.ClientOptions opts = new ActivationManagerClient.ClientOptions();
        opts.baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        ActivationManagerClient client = new ActivationManagerClient(opts);
        Result r = client.status("BAD", "m-1");
        server.stop(0);
        assertFalse(r.isSuccess());
        assertEquals("激活码不存在", r.getMessage());
    }

    @Test
    void consumeNoRetryWithoutRequestId() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = start(exchange -> {
            calls.incrementAndGet();
            exchange.sendResponseHeaders(500, -1);
        });
        ActivationManagerClient.ClientOptions opts = new ActivationManagerClient.ClientOptions();
        opts.baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        opts.maxRetries = 3;
        opts.retryDelayMs = 1;
        ActivationManagerClient client = new ActivationManagerClient(opts);
        assertThrows(ActivationManagerClient.ClientException.class, () -> client.consume("C", "m", null));
        server.stop(0);
        assertEquals(1, calls.get());
    }

    @Test
    void consumeRetriesWithRequestId() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = start(exchange -> {
            if (calls.incrementAndGet() == 1) {
                exchange.sendResponseHeaders(500, -1);
                return;
            }
            byte[] body = "{\"success\":true,\"remainingCount\":8}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });
        ActivationManagerClient.ClientOptions opts = new ActivationManagerClient.ClientOptions();
        opts.baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        opts.maxRetries = 3;
        opts.retryDelayMs = 1;
        ActivationManagerClient client = new ActivationManagerClient(opts);
        Result r = client.consume("C", "m", "req-1");
        server.stop(0);
        assertEquals(2, calls.get());
        assertTrue(r.isSuccess());
    }
}
