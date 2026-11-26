# Dynamic Pricing & Yield Management Engine

> **Kiến trúc phân tầng N-Tier (Controller - Service - Repository) trên nền tảng Java 17, Spring Boot 3.3.x & PostgreSQL 16**

Hệ thống tối ưu hóa doanh thu cho các tài sản có tính chất hết hạn theo thời gian (**Perishable Inventory**) như cụm sân thể thao (Pickleball, Cầu lông, bóng đá), phòng lưu trú hoặc phương tiện cho thuê.

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


## 6. Xác nhận thanh toán trên sandbox và production

1. Tạo lượt giữ sân. Chọn VNPay hoặc MoMo nếu cơ sở triển khai đã cấu hình cổng. Giá trị gửi sang cổng là tiền cọc hoặc tổng tiền sân theo báo giá của backend.
2. Mở liên kết do cổng trả về và hoàn tất giao dịch trên cổng. Checkout hiển thị trạng thái chờ và tự tải lại kết quả từ backend.
3. Backend chỉ ghi nhận tiền sau IPN hợp lệ, đối chiếu chữ ký, mã giao dịch và số tiền. Return URL chỉ giúp trình duyệt tìm lại đơn. Sau khi ghi nhận tiền và giữ được sân, backend mới phát hành vé QR/PIN.
4. Nếu lượt giữ hết hạn và sân không còn, hoặc phát sinh thanh toán trùng, giao dịch có bằng chứng thu tiền được lưu để đối soát. Hệ thống không tự ghi đã hoàn tiền.
5. Đơn cũ thiếu xác nhận từ cổng được hiển thị là cần đối soát. Với giao dịch VNPay cũ có mã giao dịch trùng khớp, IPN hợp lệ có thể bổ sung bằng chứng. Đơn không yêu cầu cọc có trạng thái xác nhận đặt sân và thanh toán tại quầy.

Sandbox vẫn cần thông tin do cổng cấp cho merchant. Điền `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET`. Đăng ký URL HTTPS có thể truy cập từ Internet trỏ đến `/api/v1/payments/vnpay/ipn` với VNPay. Với MoMo điền `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` và `MOMO_IPN_URL` trỏ tới `/api/v1/payments/momo/ipn` qua HTTPS. URL quay lại web có thể cấu hình riêng qua `VNPAY_RETURN_URL` và `MOMO_REDIRECT_URL`. IPN đến `localhost` chỉ tới máy gửi yêu cầu, do đó cần endpoint HTTPS công khai của môi trường thử nghiệm để nhận callback.

Chuyển khoản VietQR trực tiếp và nhập thẻ trên ArenaPulse được bỏ khỏi checkout. Khách có thể dùng các kênh QR hoặc thẻ do cổng được cấu hình cung cấp. Mobile mở luồng web qua biến Expo `EXPO_PUBLIC_WEB_CHECKOUT_URL`.

- [Phân biệt Return URL và IPN của VNPay](https://sandbox.vnpayment.vn/apis/docs/faqs/)
- [Thông báo thanh toán của MoMo](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/)
