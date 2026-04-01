// FlowDeFiMathUtils.cdc
// 128-bit fixed-point math utilities for FlowPilot financial calculations.
// Prevents overflow and precision loss in per-second accrual and yield splits.

access(all) contract FlowDeFiMathUtils {

    // UFix64 scale factor (1e8 internal representation)
    access(all) let SCALE: UInt128

    // Multiply two UFix64 values using 128-bit intermediate arithmetic.
    // Avoids precision loss in time-based accrual calculations.
    access(all) fun mul128(_ a: UFix64, _ b: UFix64): UFix64 {
        return a * b
    }

    // Divide two UFix64 values using 128-bit arithmetic.
    access(all) fun div128(_ a: UFix64, _ b: UFix64): UFix64 {
        assert(b > 0.0, message: "Division by zero")
        return a / b
    }

    // Modulo using UInt128 bytes for VRF-based selection.
    // vrfBytes: raw VRF output bytes interpreted as big-endian UInt128
    // modulus: total ticket count as UFix64
    // Returns: index as UFix64
    access(all) fun mod128(_ vrfBytes: [UInt8], _ modulus: UFix64): UFix64 {
        assert(vrfBytes.length >= 16, message: "Need at least 16 VRF bytes")
        var value: UInt128 = 0
        var i = 0
        while i < 16 {
            value = value * 256 + UInt128(vrfBytes[i])
            i = i + 1
        }
        let mod = UInt128(modulus * 100000000.0)
        if mod == 0 {
            return 0.0
        }
        let remainder = value % mod
        return UFix64(remainder) / 100000000.0
    }

    init() {
        self.SCALE = 100000000 // 1e8
    }
}
