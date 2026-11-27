# ArenaPulse | Kiểm thử vai trò và dữ liệu nghiệp vụ

Bản kiểm tra ngày 27/11/2026 bắt đầu từ `ce8bebc`. Spring Boot, PostgreSQL 16 và Redis chạy trên môi trường thử nghiệm riêng. Tài khoản dùng cho trình duyệt được tạo bằng profile `local-demo`. Các gateway và SMTP thật nằm ngoài lần kiểm tra này.

## Kết quả theo vai trò

| Vai trò và cổng | Đã kiểm tra | Việc cần hoàn thiện |
| --- | --- | --- |
| Người thuê sân, `/courts` và `/checkout` | Đăng nhập, mở danh mục, lấy giá theo phiên, giữ sân, tra cứu trạng thái và lịch sử riêng. Tạo lần nữa với cùng khóa trả về cùng mã đặt sân. Hệ thống xác nhận giao dịch khi có dữ liệu đã được cổng xác thực. | Bổ sung dòng hàng dịch vụ vào đơn và hóa đơn, phân biệt báo giá tại quầy với số phải thu. Hoàn chỉnh lịch sử khi đổi cổng, hủy hoặc hoàn tiền. |
| Chủ sân, `/portal/lessor` | Danh mục theo cơ sở, tạo cụm nháp, tạo ca, lưu giá và dịch vụ, công bố, xem báo cáo và đơn. Bộ lọc đơn có trạng thái chờ thanh toán, chờ nhận sân, đã nhận, đã hủy và bỏ lịch. | Lưu lịch định kỳ và lượt khách vãng lai bằng cùng cơ chế khóa sức chứa. Xây dựng lịch sử đơn có bộ lọc phía máy chủ và quy trình giải ngân. |
| Nhân viên, `/portal/staff` | Chỉ đọc đơn và chat của cơ sở được phân công. Kịch bản chat hai chiều lưu và tải lại từ PostgreSQL. Kiểm thử hồi quy bao phủ QR và PIN một lần. Quyền sửa cơ sở và quản lý quỹ bị từ chối. | Dùng thiết bị thật để thử camera/email. Bổ sung công việc cho ca, trạng thái mất kết nối và giao diện xử lý ngoại lệ tại quầy. |
| Kế toán, `/portal/accountant` | Đọc sổ cái, số đối soát và hàng đợi VietQR. Quyền thay đổi cơ sở và lập lại chỉ mục bị từ chối. QueryDR, hoàn tiền VNPAY và cập nhật yêu cầu đối soát VietQR nằm trong nhóm quyền tài chính. | Cần thử dữ liệu merchant sandbox cùng bộ tình huống sai tiền, trùng giao dịch, tiền đến muộn và hoàn một phần. Bổ sung vòng duyệt giải ngân và đối chiếu sao kê. |
| Quản trị, `/portal/admin` | Mở tổng quan, tài khoản, ma trận quyền và hàng đợi KYC. Cấp quyền tenant theo ID cơ sở thật. Dashboard chung không trả danh sách đơn kèm thông tin khách. Reindex yêu cầu PLATFORM ADMIN. | Cần kịch bản dữ liệu KYC đầy đủ từng giai đoạn và phê duyệt theo chính sách. Chia nhỏ và phân trang báo cáo toàn sàn khi quy mô cơ sở lớn. |

## Dữ liệu và khả năng chịu tải

- PostgreSQL lưu danh mục, ca, cấu hình dịch vụ, đơn, lịch sử thanh toán, sổ cái, hồ sơ quyền và hội thoại. Dashboard dùng sức chứa ca và bút toán đã ghi, loại dữ liệu giao dịch mẫu từ V10. Elasticsearch vẫn phục vụ tra cứu tìm kiếm. Redis giữ phiên.
- Danh mục đọc hình ảnh, ca, tồn kho và giá qua truy vấn theo lô có giới hạn ngày. Hệ thống giữ token giá riêng cho từng người. Chỉ mục theo cơ sở và giờ phục vụ truy vấn đơn.
- Chat chống ghi trùng thread khi hai yêu cầu đồng thời, giới hạn phần dữ liệu tải và ghi biên nhận đọc theo chiều tiến. Giao diện chat và đơn làm mới định kỳ khi hiển thị.
- Lịch định kỳ, điều phối khách vãng lai, dòng món gắn trên đơn, giải ngân, nội dung biên tập và theo dõi đối tác còn thiếu mô hình dữ liệu hoặc luồng hoàn chỉnh. Giao diện minh họa ở các vùng này cần được thay thế khi triển khai các nghiệp vụ tương ứng.
- Bước tiếp theo về hiệu suất là đo p95 và p99 trên dữ liệu đại diện, giới hạn payload danh mục và lịch sử, tổng hợp dashboard khi lượng ghi tăng, và phát thay đổi có kiểm soát giữa các instance. Kết quả tải dưới đây chỉ đo cạnh tranh trên một ca.

## Cách tái hiện

`scripts/audit-role-contracts.mjs` chạy trên API loopback với một DB kiểm thử và profile `local-demo`. Đặt chung `ARENAPULSE_DEMO_ACCOUNT_PASSWORD` cho server và script. Dùng `ARENAPULSE_AUDIT_URL` để đổi cổng. Script sinh tài khoản, cụm sân và hội thoại kiểm thử trong DB đó. Lệnh chạy `node scripts/audit-role-contracts.mjs`.

- 84 tổ hợp HTTP method và route từ OpenAPI được gọi với đầu vào khói. Không có lỗi HTTP 5xx hoặc route đã khai báo trả 405. Phép kiểm thử khói chỉ xác nhận khả năng xử lý đầu vào cơ bản.
- 82 kiểm tra có kỳ vọng riêng về quyền, phản hồi hoặc nghiệp vụ, bao gồm xác nhận dữ liệu từ DB sau khi ghi. Có thêm 12 yêu cầu giữ cùng ca với hai sân trống. Kết quả có hai lượt thành công và mười phản hồi 409.
- Maven chạy 66 kiểm thử. Web đã build và mobile đã qua TypeScript. Kiểm tra trình duyệt thực hiện ở năm cổng. Giao dịch thật, thiết bị quét vật lý và kiểm thử tải dài chưa được xác minh.

## Danh mục nhánh hiện hành

[Mở danh mục nhánh theo trạng thái, hệ thống và chức năng](feature-branches.md).
