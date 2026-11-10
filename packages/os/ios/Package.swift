// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NLib",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "NLib", targets: ["NLib"])
    ],
    targets: [
        .target(
            name: "NLib",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "NLibTests",
            dependencies: ["NLib"]
        )
    ]
)

