# Dynamic Pricing & Yield Management Engine

> **Kiến trúc phân tầng N-Tier (Controller - Service - Repository) trên nền tảng Java 17, Spring Boot 3.3.x & PostgreSQL 16**

Hệ thống tối ưu hóa doanh thu cho các tài sản có tính chất hết hạn theo thời gian (**Perishable Inventory**) như cụm sân thể thao (Pickleball, Cầu lông, bóng đá), phòng lưu trú hoặc phương tiện cho thuê.

[Mở danh mục nhánh theo hệ thống và chức năng](docs/feature-branches.md).

---

## 1. Chuẩn Tham Chiếu Quốc Tế

| Hệ thống Tham chiếu | Điểm Học hỏi Cốt lõi | Giải pháp Nghiệp vụ Áp dụng |
| :--- | :--- | :--- |
| **Kill Bill** *(Java Billing & Pricing)* | Bảng giá có hiệu lực theo thời gian và tính bất biến (*Immutability*) của lịch sử tính giá. | Không sửa trực tiếp giá gốc. Mỗi lần chốt giá sinh ra một `pricing_audit` (JSONB) lưu toàn bộ hệ số đã nhân để phục vụ kiểm toán. |
| **Amadeus / Airline RM** *(EMSR-b Model)* | Quản trị tài sản hết hạn theo giờ và ma trận tốc độ lấp đầy theo thời gian chờ (*Booking Pace / Lead-Time Matrix*). | Áp dụng **Ma trận 2 chiều** (Occupancy % × Lead Time Hours) để tự động kích hoạt **Surge Pricing** khi khan hiếm hoặc **Flash Discount** phút chót. |
| **Cal.com & Medusa.js** *(Scheduling & Commerce)* | Cơ chế giữ chỗ tạm thời (*Soft-Hold*) và cấp phát Price Quote Token khi sang bước thanh toán. | Tách biệt hoàn toàn luồng **Xem giá** (*Read-heavy, < 1ms*) và **Khóa sân** (*Write-contention*) bằng chữ ký điện tử HMAC-SHA256 có hạn 10 phút. |

---

## 2. Công Thức Định Giá Động (Deterministic Formula)

Tính toán 100% bằng `BigDecimal` và làm tròn đến hàng nghìn VNĐ:

$$P_{\text{raw}} = P_{\text{base}} \times M_{\text{time}} \times M_{\text{matrix}}(r_{\text{occ}}, \Delta t_{\text{lead}}) \times M_{\text{context}}$$

$$P_{\text{final}} = \min\left(P_{\text{max}}, \max\left(P_{\text{min}}, \text{round}(P_{\text{raw}}, -3)\right)\right)$$

### Ma Trận Hệ Số 2 Chiều (Occupancy % × Lead Time Hours)

| Tỷ lệ lấp đầy ($r_{\text{occ}}$) \ Thời gian còn lại ($\Delta t_{\text{lead}}$) | > 72 giờ *(Đặt sớm)* | 12h – 72h *(Tiêu chuẩn)* | 2h – 12h *(Sát giờ)* | < 2 giờ *(Phút chót)* |
| :--- | :--- | :--- | :--- | :--- |
| **Thấp (< 30% kín chỗ)** | 0.90 *(Early Bird -10%)* | 1.00 | 0.85 *(Kích cầu nhẹ)* | **0.70 *(Xả lỗ phút chót -30%)*** |
| **Trung bình (30% – 70%)** | 1.00 | 1.05 | 1.00 | 0.90 |
| **Cao (70% – 90%)** | 1.15 | 1.20 | 1.25 | 1.15 |
| **Khan hiếm (> 90% kín chỗ)** | 1.30 | 1.40 | **1.50 *(Surge Pricing)*** | 1.45 *(Khan hiếm phút chót)* |

---

## 3. Cấu Trúc Dự Án Chuẩn Spring Boot Monolith

```
DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/
├── docker-compose.yml              # PostgreSQL 16 (btree_gist) + Redis 7
├── pom.xml                         # Spring Boot 3.3.5, Java 17, Flyway, Caffeine, Lombok, Testcontainers
├── src/main/resources/
│   ├── application.yml             # Cấu hình Datasource, Cache, ThreadPool, Swagger
│   ├── application-test.yml        # Cấu hình môi trường kiểm thử
│   └── db/migration/
│       ├── V1__init_schema.sql     # 7 bảng cốt lõi, GiST exclusion constraint, composite indexes
│       └── V2__seed_default_yield_matrix.sql # Seed dữ liệu cụm 10 sân Pickleball & 16 ô ma trận
└── src/main/java/com/yieldengine/
    ├── YieldEngineApplication.java # Spring Boot Entry Point
    ├── config/                     # CacheConfig, AsyncConfig, OpenApiConfig, PricingProperties
    ├── controller/                 # TẦNG 1: PRESENTATION LAYER (REST)
    │   ├── InventoryController.java
    │   ├── PricingController.java
    │   ├── BookingController.java
    │   └── SimulationController.java
    ├── service/                    # TẦNG 2: BUSINESS LOGIC LAYER
    │   ├── InventoryService.java
    │   ├── PricingEngineService.java
    │   ├── PriceLockTokenService.java
    │   ├── BookingOrchestratorService.java
    │   ├── SimulationService.java
    │   └── listener/
    │       └── PriceRecalculationListener.java # @Async @TransactionalEventListener(AFTER_COMMIT)
    ├── repository/                 # TẦNG 3: DATA ACCESS LAYER (Spring Data JPA)
    │   ├── ResourceGroupRepository.java
    │   ├── UnitRepository.java     # findAndLockFirstAvailableUnit (FOR UPDATE SKIP LOCKED)
    │   ├── TimeSlotRepository.java
    │   ├── YieldMatrixRuleRepository.java
    │   ├── SlotPriceSnapshotRepository.java
    │   ├── ReservationRepository.java
    │   └── ConsumedTokenRepository.java
    ├── entity/                     # TẦNG 4: JPA PERSISTENCE ENTITIES
    │   ├── ResourceGroup.java
    │   ├── Unit.java
    │   ├── UnitStatus.java
    │   ├── TimeSlot.java
    │   ├── YieldMatrixRule.java
    │   ├── SlotPriceSnapshot.java
    │   ├── Reservation.java
    │   ├── ReservationStatus.java
    │   └── ConsumedToken.java
    ├── dto/                        # Request, Response & Events DTOs
    └── exception/                  # GlobalExceptionHandler (@RestControllerAdvice)
```

---

## 4. Hướng Dẫn Khởi Chạy

### 4.1. Khởi động PostgreSQL 16 & Redis
```bash
docker compose up -d
```
*(Nếu bạn đã có sẵn PostgreSQL chạy trên cổng khác, có thể chỉnh sửa trong file `.env` hoặc `application.yml`)*

### 4.2. Build và Chạy Kiểm Thử
```bash
mvn clean test
```
Kiểm thử bao gồm:
- **`PricingFormulaBoundaryTest`**: Kiểm chứng 200 tổ hợp biên đảm bảo bất biến:
  $$P_{\text{min}} \le P_{\text{final}} \le P_{\text{max}}$$
- **`PriceLockTokenServiceTest`**: Kiểm thử chữ ký HMAC-SHA256, chống sửa đổi payload, và phát hiện token hết hạn.

### 4.3. Chạy Ứng Dụng
```bash
mvn spring-boot:run
```

Truy cập Swagger UI tại:
[http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)

---

## 5. Các Endpoint API Chính

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/v1/inventory/groups` | Tạo cụm sân và tự động sinh các sân vật lý (`SAN_01` → `SAN_10`) |
| `POST` | `/api/v1/inventory/slots` | Sinh khung giờ kinh doanh và snapshot giá động ban đầu |
| `GET` | `/api/v1/pricing/quote?slotId={id}` | **Xem giá & Cấp PriceLockToken**: Phục vụ từ Cache (< 1ms, zero DB write) |
| `POST` | `/api/v1/bookings/hold` | **Giữ sân (ACID)**: Xác thực HMAC-SHA256, bốc sân qua `FOR UPDATE SKIP LOCKED`, ghi `consumed_tokens` chống replay |
| `GET` | `/api/v1/bookings/{id}/payment-status` | Người đặt đọc kết quả thanh toán đã ghi nhận |
| `POST` | `/api/v1/bookings/{id}/cancel` | Hủy đặt sân, hoàn lại số đếm `reserved_count` |
| `POST` | `/api/v1/simulations/run` | **Monte Carlo Simulation**: Giả lập 1.500 khách đặt 980 giờ sân (+35.8% RevPAR) |


## 6. Thanh toán bằng QR trên checkout

1. Tạo lượt giữ sân, chọn đặt cọc hoặc trả đủ tiền sân, chọn VietQR hoặc MoMo, nhập thông tin nhận vé rồi chọn **Tạo mã QR**.
2. Backend yêu cầu mã theo đơn từ cổng đã chọn. Checkout hiển thị QR, số tiền và thời hạn giữ sân. Tải lại trang vẫn lấy được QR của giao dịch còn chờ.
3. Khách xác nhận trong ứng dụng ngân hàng hoặc MoMo. Checkout chỉ đọc trạng thái. Backend cấp vé sau callback đã xác thực, khớp giao dịch, số tiền và đơn đặt còn đáp ứng điều kiện.
4. Nếu lượt giữ hết hạn và sân không còn, hoặc phát sinh thanh toán trùng, giao dịch có bằng chứng thu tiền được lưu để đối soát. Hệ thống không tự ghi đã hoàn tiền.
5. Đơn cũ thiếu xác nhận từ cổng được hiển thị là cần đối soát. Với giao dịch VNPay cũ có mã giao dịch trùng khớp, IPN hợp lệ có thể bổ sung bằng chứng. Đơn không yêu cầu cọc có trạng thái xác nhận đặt sân và thanh toán tại quầy.

Để thử mà không phát sinh tiền thật, dùng `MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create`, các biến `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` do MoMo cấp cho sandbox và ứng dụng **MoMo Test**. Đặt `MOMO_IPN_URL` là địa chỉ HTTPS công khai trỏ tới `/api/v1/payments/momo/ipn`. Trên production, merchant cần được MoMo cấp quyền sử dụng `qrCodeUrl`.

Checkout hỗ trợ QR VietQR và QR MoMo khi từng cổng đã được cấu hình. API chuyển trang VNPay hiện tại vẫn tiếp nhận IPN và hỗ trợ tra cứu cho giao dịch VNPay. Mobile mở checkout web qua biến Expo `EXPO_PUBLIC_WEB_CHECKOUT_URL`.

- [Phân biệt Return URL và IPN của VNPay](https://sandbox.vnpayment.vn/apis/docs/faqs/)
- [QR tích hợp trên checkout MoMo](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/)
- [Tài khoản và ứng dụng MoMo Test](https://developers.momo.vn/v3/vi/docs/payment/onboarding/test-instructions/)
- [Thông báo thanh toán của MoMo](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/)

### Kiểm tra các phương thức khác

| Phương thức | Luồng hiện tại |
| --- | --- |
| VNPay QR, thẻ nội địa, thẻ quốc tế | API tạo URL cổng bằng `VNPAYQR`, `VNBANK`, `INTCARD`. Checkout trực tiếp dùng QR VietQR hoặc QR MoMo. VNPay chỉ xác nhận thu tiền qua IPN hợp lệ. |
| VietQR chuyển khoản trực tiếp | VietQR.vn sinh mã động theo đơn và gửi biến động số dư đã xác thực. Giao dịch lệch chuyển sang đối soát. |
| Thanh toán tại sân | Với ca không yêu cầu cọc, hệ thống xác nhận đặt sân, ghi nhận đã thu online bằng 0 và hiển thị tiền phải trả tại sân. Check-in ghi nhận việc nhận sân. Chưa có bước ghi nhận nhân viên đã thu tiền tại quầy. |
| Hủy đơn có tiền đã xác minh | Tính khoản hoàn theo chính sách. Tiền chờ hoàn nằm ở tài khoản công nợ khách hàng. Với VNPay, API hoàn của kế toán cần khớp khoản đó và xác minh kết quả từ cổng trước khi chuyển sang đã hoàn. |

Phản hồi VNPay đang xử lý, mất kết nối hoặc thiếu chữ ký hợp lệ vẫn ở trạng thái chờ đối soát. Hệ thống giữ mã yêu cầu hoàn và chặn việc gửi trùng. Tác vụ tự động đối soát các yêu cầu này và hoàn tiền qua MoMo chưa được tích hợp. Báo cáo **Hoàn tiền đã xác minh** chỉ tính các bút toán có bằng chứng hoàn hợp lệ. Dữ liệu đã hạch toán trước đây thiếu xác nhận cần được rà soát riêng.

- [Mã phương thức và xác thực IPN VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
- [Chữ ký và trạng thái QueryDR, hoàn tiền VNPay](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html)

## 7. Thử VietQR trên checkout

### Phương án 1. Thử tự động với PostgreSQL và Redis

Chạy từ thư mục gốc. Bộ kiểm thử dùng máy chủ VietQR mô phỏng trên loopback và xác minh callback qua HTTP. Không cần merchant hoặc tài khoản ngân hàng.

```sh
docker compose up -d postgres redis
ELASTICSEARCH_ENABLED=false mvn -Dtest=V3MarketplaceIntegrationTest test
```

### Phương án 2. Tự thao tác trên web với VietQR mô phỏng

Dùng cơ sở dữ liệu thử riêng. Mở ba cửa sổ Terminal và chạy từ thư mục gốc.

**Terminal 1** mở cổng mô phỏng bằng Node.js 18 trở lên.

```sh
node src/test/fixtures/vietqr-sandbox.mjs
```

**Terminal 2** mở backend với tài khoản và khóa giả lập.

```sh
VIETQR_ENABLED=true \
VIETQR_MODE=SANDBOX \
VIETQR_SANDBOX_BASE_URL=http://127.0.0.1:18121 \
VIETQR_MERCHANT_USERNAME=fixture-merchant \
VIETQR_MERCHANT_PASSWORD=fixture-secret \
VIETQR_CALLBACK_USERNAME=fixture-callback \
VIETQR_CALLBACK_PASSWORD=fixture-callback-password \
VIETQR_CALLBACK_SECRET=fixture-vietqr-signing-secret-local-only \
VIETQR_BANK_CODE=MB VIETQR_BANK_ACCOUNT=10000001 \
VIETQR_ACCOUNT_NAME='ARENA TEST' \
ELASTICSEARCH_ENABLED=false mvn spring-boot:run
```

**Terminal 3** mở frontend tại `http://localhost:5174`.

```sh
cd frontend
npm ci
VITE_API_TARGET=http://127.0.0.1:8080 npm run dev
```

Đăng nhập, giữ sân, chọn **Chuyển khoản VietQR**, nhập thông tin nhận vé và bấm **Tạo mã QR**. Sao chép **Mã giao dịch** trên checkout vào `orderId`.

```sh
curl -sS http://127.0.0.1:18121/simulate \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"AP_MA_TREN_CHECKOUT","eventId":"vietqr-test-01","case":"exact"}'
```

| Kiểm thử | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| Chưa có tiền | Tạo mã, tải lại trang | Vẫn hiện QR và trạng thái chờ. Vé chưa phát hành. |
| Đúng tiền | Gửi `exact` | Ghi nhận tiền cọc hoặc toàn bộ tiền sân và cấp vé. |
| Gửi lặp | Gửi lại cùng `orderId` và `eventId` | Cùng mã tiếp nhận. Chỉ một bút toán và một vé cho đơn. |
| Thiếu, dư, sai nội dung | Dùng `short`, `over` hoặc `wrong-content` với `eventId` mới | Vào danh sách đối soát. Khoản sai không xác nhận đơn. |
| Tiền đến lần nữa | Sau khi đã xác nhận, gửi `exact` với `eventId` mới | Giữ nguyên biên lai và vé, đưa khoản chuyển thêm vào đối soát. |
| Token sai hoặc giao dịch đi | Dùng `bad-token` hoặc `outgoing` | Token sai bị từ chối. Giao dịch ghi nợ không xác nhận đơn. |

### Phương án 3. Thử qua sandbox VietQR.vn

1. Dùng thông tin merchant sandbox do VietQR.vn cấp, điền tài khoản nhận test và thông tin `VIETQR_CALLBACK_*` riêng theo `.env.example`. Đặt `VIETQR_MODE=SANDBOX`, `VIETQR_ENABLED=true` và `VIETQR_SANDBOX_BASE_URL=https://dev.vietqr.org`.
2. Cấu hình hai URL HTTPS công khai cho VietQR. ArenaPulse cấp token với cặp Basic Auth `VIETQR_CALLBACK_USERNAME` và `VIETQR_CALLBACK_PASSWORD`; callback gửi token đó qua Bearer Auth.

   | Chức năng | Đường dẫn sau tên miền backend |
   | --- | --- |
   | Cấp token cho VietQR | `/api/v1/payments/vietqr/api/token_generate` |
   | Nhận thông báo giao dịch | `/api/v1/payments/vietqr/bank/api/transaction-sync` |

3. Tạo một QR động từ checkout. Dùng **Test Callback** của VietQR với token merchant sandbox và `bankCode`, `bankAccount`, `amount`, `content` trả về từ giao dịch tạo mã, cùng `transType=C`. `content` cần lấy đúng nội dung đã trả về, gồm tiền tố VietQR thêm vào nếu có. Chờ checkout nhận xác nhận rồi kiểm tra vé.
4. Đăng nhập bằng tài khoản ADMIN hoặc ACCOUNTANT và vào phần **Sổ cái & Đối soát** để xem giao dịch lệch. Ghi kết quả đã đối soát để đóng hồ sơ. Thao tác này lưu ghi chú, người xử lý và thời gian, không phát hành vé hay chuyển tiền.

Khi go-live, dùng cấu hình và khóa riêng cho `LIVE` trên môi trường production. Endpoint live được chọn sẵn từ cấu hình chế độ. VietQR Sandbox dùng giao dịch giả lập; hoàn tiền VietQR còn được xử lý thủ công sau đối soát.

- [Sinh mã VietQR động](https://api.vietqr.vn/vi/api-vietqr-callback/goi-api-generate-vietqr-code)
- [API Test Callback](https://api.vietqr.vn/vi/api-vietqr-callback/goi-api-test-callback)
- [API nhận giao dịch VietQR](https://api.vietqr.vn/vi/api-vietqr-callback/api-transaction-sync)
