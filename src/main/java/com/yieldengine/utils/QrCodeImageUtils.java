package com.yieldengine.utils;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.io.ByteArrayOutputStream;
import java.util.Map;

/**
 * Isolated ZXing QR matrix renderer producing PNG byte payloads for e-tickets.
 */
public final class QrCodeImageUtils {

    private QrCodeImageUtils() {
    }

    public static byte[] renderQrPng(String qrContent, int sizePx) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(
                    qrContent,
                    BarcodeFormat.QR_CODE,
                    sizePx,
                    sizePx,
                    Map.of(
                            EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                            EncodeHintType.MARGIN, 2,
                            EncodeHintType.CHARACTER_SET, "UTF-8"
                    )
            );
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed rendering QR PNG image", ex);
        }
    }
}
