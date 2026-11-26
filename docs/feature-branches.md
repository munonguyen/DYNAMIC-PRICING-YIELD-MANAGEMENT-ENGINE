# Nhánh theo chức năng ArenaPulse

Mỗi nhánh hoạt động có dạng `service/<hệ-thống>/<chức-năng>`. Các cổng thanh toán dùng thêm nhóm `payments`. `main` là bản tích hợp chạy toàn hệ thống. Các nhánh chức năng dùng cùng nền mã nguồn để giữ khả năng xây dựng và kiểm thử trên toàn ứng dụng.

Ví dụ, **Danh sách sân đã thuê** của chủ sân theo dõi ca đã nhận sân (`COMPLETED`). **Đơn chờ thanh toán** theo dõi lượt giữ sân (`HELD`). Hai chức năng dùng chung API `GET /api/v1/checkins/orders` và có phạm vi theo dõi riêng.

## Làm việc trên một chức năng

1. Chọn nhánh trong bảng theo màn hình hoặc nghiệp vụ cần sửa.
2. Xem hồ sơ JSON trên nhánh để biết phần mã nguồn phụ trách, API và phương thức kiểm tra. Thay đổi giao diện, API hoặc kiểm thử có thể đi qua nhiều thư mục trong cùng nhánh khi phục vụ chức năng đó.
3. Cập nhật nhánh từ `main` và đưa thay đổi trở về `main` khi sẵn sàng tích hợp.

Chạy kiểm tra hợp đồng trên một nhánh bằng Node.js 22 trở lên.

```sh
git switch service/lessor/rented-courts
node scripts/verify-feature-contracts.mjs
```

Nếu có Spring Boot đang chạy, tải OpenAPI từ `/v3/api-docs` vào một tệp và truyền đường dẫn qua `ARENAPULSE_OPENAPI_FILE` khi chạy script. Kết quả xác nhận mã nguồn tham chiếu và khai báo API, còn hành vi nghiệp vụ và phân quyền được kiểm tra bằng bộ test ứng dụng.

Các nhánh gộp cũ được lưu dưới tag `archive/pre-feature-layout/<tên-nhánh-cũ>`. Có thể tra lại hoặc lấy mã nguồn từ tag bằng `git switch --detach <tag>`. Nhánh VietQR đang dùng tiếp tục cùng lịch sử commit.

## Danh mục chức năng

### Chủ sân

| Chức năng | Nhánh |
| --- | --- |
| Chính sách hủy sân | [`service/lessor/cancellation-policies`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/cancellation-policies/contracts/features/lessor/cancellation-policies.json) |
| Danh mục dịch vụ đi kèm | [`service/lessor/court-add-ons`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-add-ons/contracts/features/lessor/court-add-ons.json) |
| Quản lý cụm sân | [`service/lessor/court-groups`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-groups/contracts/features/lessor/court-groups.json) |
| Quản lý ảnh sân | [`service/lessor/court-media`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-media/contracts/features/lessor/court-media.json) |
| Cấu hình giá và cọc | [`service/lessor/court-pricing`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-pricing/contracts/features/lessor/court-pricing.json) |
| Công bố cụm sân | [`service/lessor/court-publishing`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-publishing/contracts/features/lessor/court-publishing.json) |
| Quản lý ca sân | [`service/lessor/court-slots`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/court-slots/contracts/features/lessor/court-slots.json) |
| Quản lý đơn chờ thanh toán | [`service/lessor/deposit-bookings`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/deposit-bookings/contracts/features/lessor/deposit-bookings.json) |
| Nhận sân thủ công | [`service/lessor/manual-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/manual-check-in/contracts/features/lessor/manual-check-in.json) |
| Danh sách sân đã thuê | [`service/lessor/rented-courts`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/rented-courts/contracts/features/lessor/rented-courts.json) |
| Mô phỏng doanh thu | [`service/lessor/revenue-simulation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/revenue-simulation/contracts/features/lessor/revenue-simulation.json) |
| Cấp tài khoản nhân viên | [`service/lessor/staff-accounts`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/staff-accounts/contracts/features/lessor/staff-accounts.json) |
| Dashboard cơ sở | [`service/lessor/venue-dashboard`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/venue-dashboard/contracts/features/lessor/venue-dashboard.json) |
| Cài đặt cơ sở | [`service/lessor/venue-settings`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/lessor/venue-settings/contracts/features/lessor/venue-settings.json) |

### Khách thuê sân

| Chức năng | Nhánh |
| --- | --- |
| Hủy đặt sân | [`service/customer/booking-cancellation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/booking-cancellation/contracts/features/customer/booking-cancellation.json) |
| Thanh toán đơn sân | [`service/customer/checkout`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/checkout/contracts/features/customer/checkout.json) |
| Giữ sân | [`service/customer/court-booking`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/court-booking/contracts/features/customer/court-booking.json) |
| Tìm sân | [`service/customer/court-search`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/court-search/contracts/features/customer/court-search.json) |
| Vé nhận sân | [`service/customer/entry-tickets`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/entry-tickets/contracts/features/customer/entry-tickets.json) |
| Đăng ký trở thành chủ sân | [`service/customer/lessor-onboarding`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/lessor-onboarding/contracts/features/customer/lessor-onboarding.json) |
| Lịch sử thanh toán | [`service/customer/payment-history`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/customer/payment-history/contracts/features/customer/payment-history.json) |

### Nhân viên tại quầy

| Chức năng | Nhánh |
| --- | --- |
| Danh sách đơn tại quầy | [`service/staff/arrival-orders`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/staff/arrival-orders/contracts/features/staff/arrival-orders.json) |
| Ghi nhận khách bỏ lịch | [`service/staff/no-show`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/staff/no-show/contracts/features/staff/no-show.json) |
| Nhận sân bằng PIN | [`service/staff/pin-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/staff/pin-check-in/contracts/features/staff/pin-check-in.json) |
| Quét QR nhận sân | [`service/staff/qr-check-in`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/staff/qr-check-in/contracts/features/staff/qr-check-in.json) |
| Chat hỗ trợ khách | [`service/staff/venue-chat`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/staff/venue-chat/contracts/features/staff/venue-chat.json) |

### Kế toán

| Chức năng | Nhánh |
| --- | --- |
| Quy tắc hoa hồng | [`service/accountant/commission-rules`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/commission-rules/contracts/features/accountant/commission-rules.json) |
| Kiểm toán tài chính | [`service/accountant/financial-audit`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/financial-audit/contracts/features/accountant/financial-audit.json) |
| Sổ cái | [`service/accountant/ledger`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/ledger/contracts/features/accountant/ledger.json) |
| Đối soát sổ cái | [`service/accountant/reconciliation`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/reconciliation/contracts/features/accountant/reconciliation.json) |
| Đối soát ngoại lệ VietQR | [`service/accountant/vietqr-transfer-review`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/vietqr-transfer-review/contracts/features/accountant/vietqr-transfer-review.json) |
| Hoàn tiền VNPAY | [`service/accountant/vnpay-refund`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/vnpay-refund/contracts/features/accountant/vnpay-refund.json) |
| Tra cứu giao dịch VNPAY | [`service/accountant/vnpay-transaction-query`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/accountant/vnpay-transaction-query/contracts/features/accountant/vnpay-transaction-query.json) |

### Quản trị

| Chức năng | Nhánh |
| --- | --- |
| Quản lý tài khoản | [`service/admin/account-management`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/account-management/contracts/features/admin/account-management.json) |
| Duyệt hồ sơ chủ sân | [`service/admin/kyc-review`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/kyc-review/contracts/features/admin/kyc-review.json) |
| Nhật ký quản trị toàn sàn | [`service/admin/platform-audit`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/platform-audit/contracts/features/admin/platform-audit.json) |
| Dashboard toàn sàn | [`service/admin/platform-dashboard`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/platform-dashboard/contracts/features/admin/platform-dashboard.json) |
| Phân quyền tài khoản | [`service/admin/role-assignment`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/role-assignment/contracts/features/admin/role-assignment.json) |
| Lập lại chỉ mục tìm kiếm | [`service/admin/search-reindex`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/search-reindex/contracts/features/admin/search-reindex.json) |
| Danh mục môn thể thao | [`service/admin/sport-catalogue`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/sport-catalogue/contracts/features/admin/sport-catalogue.json) |
| Quản trị cơ sở đối tác | [`service/admin/venue-governance`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/admin/venue-governance/contracts/features/admin/venue-governance.json) |

### Dùng chung

| Chức năng | Nhánh |
| --- | --- |
| Đăng nhập và quản lý phiên | [`service/shared/auth-session`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/shared/auth-session/contracts/features/shared/auth-session.json) |
| Cổng MoMo | [`service/shared/payments/momo-wallet`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/shared/payments/momo-wallet/contracts/features/shared/payments/momo-wallet.json) |
| Cổng VietQR | [`service/shared/payments/vietqr-transfer`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/shared/payments/vietqr-transfer/contracts/features/shared/payments/vietqr-transfer.json) |
| Cổng VNPAY | [`service/shared/payments/vnpay-gateway`](https://github.com/munonguyen/DYNAMIC-PRICING-YIELD-MANAGEMENT-ENGINE/blob/service/shared/payments/vnpay-gateway/contracts/features/shared/payments/vnpay-gateway.json) |
