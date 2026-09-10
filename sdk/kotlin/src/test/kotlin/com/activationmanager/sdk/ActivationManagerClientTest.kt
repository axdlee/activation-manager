package com.activationmanager.sdk

import com.sun.net.httpserver.HttpServer
import org.junit.Assert.*
import org.junit.Test
import java.io.OutputStream
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicInteger
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class ActivationManagerClientTest {

    private fun start(handler: (com.sun.net.httpserver.HttpExchange) -> Unit): HttpServer {
        val server = HttpServer.create(InetSocketAddress(0), 0)
        server.createContext("/") { exchange -> handler(exchange) }
        server.start()
        return server
    }

    private fun respond(exchange: com.sun.net.httpserver.HttpExchange, body: String, sign: Boolean, secret: String = "test-secret") {
        val sig = if (sign) {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
            mac.doFinal(body.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }
        } else ""
        exchange.responseHeaders.add("Content-Type", "application/json")
        if (sign) {
            exchange.responseHeaders.add("x-license-signature", sig)
            exchange.responseHeaders.add("x-license-timestamp", System.currentTimeMillis().toString())
        }
        val bytes = body.toByteArray(StandardCharsets.UTF_8)
        exchange.sendResponseHeaders(200, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }

    @Test
    fun activateSuccessAndSignature() {
        val server = start { exchange ->
            respond(exchange, "{\"success\":true,\"licenseMode\":\"COUNT\",\"license_mode\":\"COUNT\",\"remainingCount\":9,\"valid\":true}", sign = true)
        }
        val client = ActivationManagerClient(ActivationManagerClient.Options(
            baseUrl = "http://127.0.0.1:${server.address.port}", projectKey = "demo", responseSecret = "test-secret"))
        val r = client.activate("CODE-1", "m-1")
        server.stop(0)
        assertTrue(r.success)
        assertEquals("COUNT", r.licenseMode)
        assertEquals(9L, r.remainingCount)
    }

    @Test
    fun businessFailurePassthrough() {
        val server = start { exchange ->
            respond(exchange, "{\"success\":false,\"message\":\"激活码不存在\"}", sign = false)
        }
        val client = ActivationManagerClient(ActivationManagerClient.Options(
            baseUrl = "http://127.0.0.1:${server.address.port}"))
        val r = client.status("BAD", "m-1")
        server.stop(0)
        assertFalse(r.success)
        assertEquals("激活码不存在", r.message)
    }

    @Test
    fun consumeNoRetryWithoutRequestId() {
        val calls = AtomicInteger()
        val server = start { exchange ->
            calls.incrementAndGet()
            exchange.sendResponseHeaders(500, -1)
        }
        val client = ActivationManagerClient(ActivationManagerClient.Options(
            baseUrl = "http://127.0.0.1:${server.address.port}", maxRetries = 3, retryDelayMs = 1))
        try {
            client.consume("C", "m", null)
            fail("should throw")
        } catch (e: ActivationManagerClient.ClientException) {
            assertEquals(1, e.attemptCount)
        }
        server.stop(0)
        assertEquals(1, calls.get())
    }

    @Test
    fun consumeRetriesWithRequestId() {
        val calls = AtomicInteger()
        val server = start { exchange ->
            if (calls.incrementAndGet() == 1) {
                exchange.sendResponseHeaders(500, -1)
                return@start
            }
            respond(exchange, "{\"success\":true,\"remainingCount\":8}", sign = false)
        }
        val client = ActivationManagerClient(ActivationManagerClient.Options(
            baseUrl = "http://127.0.0.1:${server.address.port}", maxRetries = 3, retryDelayMs = 1))
        val r = client.consume("C", "m", "req-1")
        server.stop(0)
        assertEquals(2, calls.get())
        assertTrue(r.success)
    }
}
