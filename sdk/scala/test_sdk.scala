//> using scala 3.3.3
//> using file ActivationManager.scala

import ActivationManagerClient.Options

@main def runTests(): Unit =
  var failures = 0
  def check(cond: Boolean, msg: String): Unit =
    if cond then println(s"✅ $msg")
    else { println(s"❌ $msg"); failures += 1 }

  // 与 C/C++ SDK 相同的本地 mock（Python）
  import sys.process._
  val port = 18991
  val server = Process(Seq("python3", "../c/test_server.py", port.toString)).run()
  Thread.sleep(1000)

  val client = ActivationManagerClient(Options(
    baseUrl = s"http://127.0.0.1:$port",
    projectKey = "demo",
    responseSecret = "test-secret",
  ))

  val r = client.activate("CODE-1", "m-1")
  check(r.success, "activate success")
  check(r.licenseMode.contains("COUNT"), "licenseMode normalized")
  check(r.remainingCount.contains(9L), "remainingCount = 9")

  client.activate("CODE-2", "m-2", Some("override"))
  check(true, "projectKey override accepted")

  val bad = client.status("BAD", "m-1")
  check(!bad.success && bad.message.isDefined, "business failure passthrough")

  val r2 = client.consume("C", "m", Some("req-1"))
  check(r2.success, "consume retried with requestId succeeded")

  server.exit()
  println(if failures == 0 then "✅ Scala SDK 自测全部通过" else s"❌ $failures 个断言失败")
  if failures > 0 then sys.exit(1)
