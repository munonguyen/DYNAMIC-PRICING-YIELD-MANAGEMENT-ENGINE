# Nhánh theo trạng thái và chức năng ArenaPulse

Mỗi hệ thống có một nhánh hoạt động cho từng chức năng. Tên nhánh có dạng `<trạng-thái>/<hệ-thống>/<chức-năng>`. Các cổng thanh toán dùng thêm nhóm `payments`. `main` tích hợp mã nguồn toàn hệ thống.

- `initial/` dùng khi chức năng đã có mã triển khai và còn bước kiểm chứng nghiệp vụ. Hồ sơ chức năng ghi rõ bước đang chờ.
- `complete/` dùng cho phạm vi chức năng đã tích hợp và kiểm tra trong môi trường QA.

Ví dụ, **Danh sách sân đã thuê** của chủ sân theo dõi ca đã nhận sân (`COMPLETED`). **Đơn chờ thanh toán** theo dõi lượt giữ sân (`HELD`). Hai chức năng dùng chung API `GET /api/v1/checkins/orders` và có phạm vi theo dõi riêng.

## Làm việc trên một chức năng

1. Chọn nhánh trong bảng theo màn hình hoặc nghiệp vụ cần sửa.
2. Xem hồ sơ JSON trên nhánh để biết phần mã nguồn phụ trách, API và phương thức kiểm tra. Thay đổi giao diện, API hoặc kiểm thử có thể đi qua nhiều thư mục trong cùng nhánh khi phục vụ chức năng đó.
3. Cập nhật nhánh từ `main` và đưa thay đổi trở về `main` khi sẵn sàng tích hợp. Khi hoàn tất các bước kiểm chứng, đổi tên nhánh từ `initial/` sang `complete/`.

Chạy kiểm tra hợp đồng trên một nhánh bằng Node.js 22 trở lên.

```sh
git switch complete/lessor/rented-courts
node scripts/verify-feature-contracts.mjs
```

Nếu có Spring Boot đang chạy, tải OpenAPI từ `/v3/api-docs` vào một tệp và truyền đường dẫn qua `ARENAPULSE_OPENAPI_FILE` khi chạy script. Kết quả xác nhận mã nguồn tham chiếu và khai báo API, còn hành vi nghiệp vụ và phân quyền được kiểm tra bằng bộ test ứng dụng.

Các nhánh gộp cũ được lưu dưới tag `archive/pre-feature-layout/<tên-nhánh-cũ>`. Có thể tra lại hoặc lấy mã nguồn từ tag bằng `git switch --detach <tag>`. Các nhánh theo trạng thái tiếp tục lịch sử commit của từng chức năng.

## Danh mục chức năng

### Chủ sân

| Chức năng | Nhánh |
| --- | --- |
| Chính sách hủy sân | [`complete/lessor/cancellation-policies`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/cancellation-policies/contracts/features/lessor/cancellation-policies.json) |
| Danh mục dịch vụ đi kèm | [`complete/lessor/court-add-ons`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-add-ons/contracts/features/lessor/court-add-ons.json) |
| Quản lý cụm sân | [`complete/lessor/court-groups`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-groups/contracts/features/lessor/court-groups.json) |
| Quản lý ảnh sân | [`complete/lessor/court-media`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-media/contracts/features/lessor/court-media.json) |
| Cấu hình giá và cọc | [`complete/lessor/court-pricing`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-pricing/contracts/features/lessor/court-pricing.json) |
| Công bố cụm sân | [`complete/lessor/court-publishing`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-publishing/contracts/features/lessor/court-publishing.json) |
| Quản lý ca sân | [`complete/lessor/court-slots`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/court-slots/contracts/features/lessor/court-slots.json) |
| Quản lý đơn chờ thanh toán | [`complete/lessor/deposit-bookings`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/deposit-bookings/contracts/features/lessor/deposit-bookings.json) |
| Nhận sân thủ công | [`complete/lessor/manual-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/manual-check-in/contracts/features/lessor/manual-check-in.json) |
| Danh sách sân đã thuê | [`complete/lessor/rented-courts`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/rented-courts/contracts/features/lessor/rented-courts.json) |
| Mô phỏng doanh thu | [`complete/lessor/revenue-simulation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/revenue-simulation/contracts/features/lessor/revenue-simulation.json) |
| Cấp tài khoản nhân viên | [`complete/lessor/staff-accounts`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/staff-accounts/contracts/features/lessor/staff-accounts.json) |
| Dashboard cơ sở | [`complete/lessor/venue-dashboard`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/venue-dashboard/contracts/features/lessor/venue-dashboard.json) |
| Cài đặt cơ sở | [`complete/lessor/venue-settings`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/lessor/venue-settings/contracts/features/lessor/venue-settings.json) |

### Khách thuê sân

| Chức năng | Nhánh |
| --- | --- |
| Hủy đặt sân | [`complete/customer/booking-cancellation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/booking-cancellation/contracts/features/customer/booking-cancellation.json) |
| Thanh toán đơn sân | [`complete/customer/checkout`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/checkout/contracts/features/customer/checkout.json) |
| Giữ sân | [`complete/customer/court-booking`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/court-booking/contracts/features/customer/court-booking.json) |
| Tìm sân | [`complete/customer/court-search`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/court-search/contracts/features/customer/court-search.json) |
| Vé nhận sân | [`complete/customer/entry-tickets`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/entry-tickets/contracts/features/customer/entry-tickets.json) |
| Đăng ký trở thành chủ sân | [`initial/customer/lessor-onboarding`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/customer/lessor-onboarding/contracts/features/customer/lessor-onboarding.json) |
| Lịch sử thanh toán | [`complete/customer/payment-history`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/customer/payment-history/contracts/features/customer/payment-history.json) |

### Nhân viên tại quầy

| Chức năng | Nhánh |
| --- | --- |
| Danh sách đơn tại quầy | [`complete/staff/arrival-orders`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/staff/arrival-orders/contracts/features/staff/arrival-orders.json) |
| Ghi nhận khách bỏ lịch | [`complete/staff/no-show`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/staff/no-show/contracts/features/staff/no-show.json) |
| Nhận sân bằng PIN | [`complete/staff/pin-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/staff/pin-check-in/contracts/features/staff/pin-check-in.json) |
| Quét QR nhận sân | [`complete/staff/qr-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/staff/qr-check-in/contracts/features/staff/qr-check-in.json) |
| Chat hỗ trợ khách | [`complete/staff/venue-chat`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/staff/venue-chat/contracts/features/staff/venue-chat.json) |

### Kế toán

| Chức năng | Nhánh |
| --- | --- |
| Quy tắc hoa hồng | [`complete/accountant/commission-rules`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/accountant/commission-rules/contracts/features/accountant/commission-rules.json) |
| Kiểm toán tài chính | [`complete/accountant/financial-audit`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/accountant/financial-audit/contracts/features/accountant/financial-audit.json) |
| Sổ cái | [`complete/accountant/ledger`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/accountant/ledger/contracts/features/accountant/ledger.json) |
| Đối soát sổ cái | [`complete/accountant/reconciliation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/accountant/reconciliation/contracts/features/accountant/reconciliation.json) |
| Đối soát ngoại lệ VietQR | [`initial/accountant/vietqr-transfer-review`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/accountant/vietqr-transfer-review/contracts/features/accountant/vietqr-transfer-review.json) |
| Hoàn tiền VNPAY | [`initial/accountant/vnpay-refund`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/accountant/vnpay-refund/contracts/features/accountant/vnpay-refund.json) |
| Tra cứu giao dịch VNPAY | [`initial/accountant/vnpay-transaction-query`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/accountant/vnpay-transaction-query/contracts/features/accountant/vnpay-transaction-query.json) |

### Quản trị

| Chức năng | Nhánh |
| --- | --- |
| Quản lý tài khoản | [`complete/admin/account-management`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/account-management/contracts/features/admin/account-management.json) |
| Duyệt hồ sơ chủ sân | [`initial/admin/kyc-review`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/admin/kyc-review/contracts/features/admin/kyc-review.json) |
| Nhật ký quản trị toàn sàn | [`complete/admin/platform-audit`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/platform-audit/contracts/features/admin/platform-audit.json) |
| Dashboard toàn sàn | [`complete/admin/platform-dashboard`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/platform-dashboard/contracts/features/admin/platform-dashboard.json) |
| Phân quyền tài khoản | [`complete/admin/role-assignment`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/role-assignment/contracts/features/admin/role-assignment.json) |
| Lập lại chỉ mục tìm kiếm | [`complete/admin/search-reindex`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/search-reindex/contracts/features/admin/search-reindex.json) |
| Danh mục môn thể thao | [`complete/admin/sport-catalogue`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/sport-catalogue/contracts/features/admin/sport-catalogue.json) |
| Quản trị cơ sở đối tác | [`complete/admin/venue-governance`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/admin/venue-governance/contracts/features/admin/venue-governance.json) |

### Dùng chung

| Chức năng | Nhánh |
| --- | --- |
| Đăng nhập và quản lý phiên | [`complete/shared/auth-session`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/complete/shared/auth-session/contracts/features/shared/auth-session.json) |
| Cổng MoMo | [`initial/shared/payments/momo-wallet`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/shared/payments/momo-wallet/contracts/features/shared/payments/momo-wallet.json) |
| Cổng VietQR | [`initial/shared/payments/vietqr-transfer`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/shared/payments/vietqr-transfer/contracts/features/shared/payments/vietqr-transfer.json) |
| Cổng VNPAY | [`initial/shared/payments/vnpay-gateway`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/initial/shared/payments/vnpay-gateway/contracts/features/shared/payments/vnpay-gateway.json) |
