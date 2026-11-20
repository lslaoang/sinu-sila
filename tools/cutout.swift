// Remove the background from portraits with macOS Vision (on-device, no download), so every face sits on the same
// background. Writes a transparent PNG next to each input; tools/cutout_photos.py turns those into WebP.
// Run: swift tools/cutout.swift in1.webp [in2.webp ...]      (macOS 14+)
// Prints "ok <file>" or "skip <file> <reason>" per input.
import Foundation
import Vision
import CoreImage
import ImageIO

let ctx = CIContext()
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("skip \(path) unreadable"); continue }
    let req = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cg)
    do {
        try handler.perform([req])
        guard let obs = req.results?.first, !obs.allInstances.isEmpty else { print("skip \(path) no-subject"); continue }
        let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
        let out = url.deletingPathExtension().appendingPathExtension("cut.png")
        try ctx.writePNGRepresentation(of: CIImage(cvPixelBuffer: buf), to: out, format: .RGBA8,
                                       colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
        print("ok \(path) instances=\(obs.allInstances.count)")
    } catch { print("skip \(path) \(error.localizedDescription)") }
}
