// swift-tools-version:5.9
// Activation Manager SDK — Swift 5.9+（macOS 12+ / Linux）
import PackageDescription

let package = Package(
    name: "ActivationManagerSDK",
    platforms: [.macOS(.v12)],
    products: [
        .library(name: "ActivationManagerSDK", targets: ["ActivationManagerSDK"]),
    ],
    dependencies: [
        // Linux 上 CryptoKit 不可用，用 swift-crypto（macOS/Linux 通用）
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "ActivationManagerSDK",
            dependencies: [.product(name: "Crypto", package: "swift-crypto")]
        ),
    ]
)
