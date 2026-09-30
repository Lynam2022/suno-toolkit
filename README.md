---
title: Suno Toolkit
emoji: 🎛️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Suno Audio Anonymization & Clarity Optimizer (chunks.md Local Edition)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Lynam2022/suno-toolkit)

Dự án dựng lại 100% giao diện, thông số cấu hình và thuật toán xử lý âm thanh từ trang [chunks.md/#suno](https://chunks.md/#suno). Ứng dụng hoạt động trực tiếp trong trình duyệt bằng Web Audio API thuần (Client-Side), không gửi bất kỳ dữ liệu nào ra máy chủ bên ngoài.

---

## 🚀 Cách mở và chạy ứng dụng

Ứng dụng hiện đang được mở và phục vụ cục bộ tại:
👉 **[http://127.0.0.1:3300/](http://127.0.0.1:3300/)**

Để khởi động lại máy chủ bất cứ lúc nào:
```bash
node "d:\tao thủ\server.js"
```
Hoặc mở trực tiếp file `index.html` trong trình duyệt.

---

## 🎛️ Danh mục các tính năng & Thuật toán xử lý

Toàn bộ quy trình DSP được tái tạo chuẩn xác theo mã nguồn của `chunks.md`:

### 1. Hệ thống Presets mẫu
- **Subtle (Tinh tế / Giữ chất âm)**: Dịch cao độ nhẹ (-1 semitone), tốc độ x1.01, MP3 192 kbps, không dùng EQ tilt hay jitter.
- **Moderate (Tiêu chuẩn mặc định)**: Dịch -2 semitones, tốc độ 95%, 48 kHz, vang 15%, pad 0.5s, MP3 128 kbps, EQ tilt 1.5 dB (6 dải), Jitter full-mix 10¢ và side-channel 8¢.
- **Aggressive (Mạnh mẽ)**: Dịch -4 semitones, tốc độ 93%, 48 kHz, cắt notch 300 Hz, vang 25%, pad 0.5s, MP3 96 kbps, EQ tilt 2.5 dB, Jitter 15¢, Peak smear 5 dải, hạ âm 7 Hz.
- **Instrumental (Tách Beat)**: Kích hoạt chế độ `Light` (triệt tiêu dải tần giọng hát kênh trung tâm `L - R`), giữ nguyên dải nhạc nền hai bên.
- **⚡ Clear Master Mode (Tối ưu âm thanh rõ nét)**: Chế độ bổ sung giúp giữ trọn 100% chất lượng giọng hát, tempo 100%, 48000 Hz, MP3 320 kbps, loại bỏ hiện tượng nhòe pha và méo tiếng.

---

### 2. Chi tiết các thông số trong Advanced Settings

| Thông số | Giải thích & Thuật toán | Mẹo để âm thanh rõ nét nhất |
| :--- | :--- | :--- |
| **Instrumental only** | `Off` / `Light` / `Hard`. Chế độ `Light` dùng thuật toán khử giọng trung tâm `0.5 * (L - R)`. | Chọn **Off** để giữ nguyên giọng ca sĩ. |
| **Pitch (semitones)** | Dịch chuyển cao độ từ -12 đến +12 semitones mà không đổi tốc độ. | Đặt **0** để giữ nguyên tone gốc bài hát. |
| **Tempo (%)** | Co giãn thời gian bằng thuật toán SOLA (Hann-windowed Overlap-Add) giữ nguyên cao độ. | Đặt **100%** để bài hát không bị biến dạng pha. |
| **Sample rate (Hz)** | Tần số lấy mẫu âm thanh đầu ra (44100 Hz / 48000 Hz). | Đặt **48000 Hz** chuẩn Studio. |
| **EQ notch (Hz)** | Bộ lọc Biquad Notch cắt bỏ một tần số cụ thể (Q = 30). | Để **trống (Off)**. |
| **Reverb wet (%)** | Hiệu ứng vang thông qua Convolver nhân tạo với hàm phân rã mũ (Exponential Decay Impulse Response). | Đặt **0%** để âm thanh khô, sắc nét. |
| **Silence pad (s)** | Chèn khoảng im lặng ở đầu file. | Đặt **0s**. |
| **Normalize peak to 1.0** | Quét biên độ đỉnh lớn nhất và khuếch đại về đúng mức 1.0 (0 dBFS). | **Bật (Checked)** để tối ưu âm lượng to rõ không vỡ tiếng. |
| **MP3 round-trip bitrate** | Mã hóa LameJS MP3 rồi giải mã ngược lại để xáo trộn các đỉnh phổ âm thanh. | Chọn **320 kbps** để giữ trọn dải treble leng keng. |
| **EQ tilt max ±dB & Bands** | Tạo ngẫu nhiên các bộ lọc Peaking Biquad trên dải logarit từ 120 Hz đến 10 kHz. | Đặt **0 dB** và **0 bands**. |
| **Full-mix pitch jitter** | Rung cao độ theo sóng tam giác Triangle LFO (0 đến 50 cents). | Đặt **0 cents**. |
| **Side-channel jitter** | Rung lệch pha dải M/S (Mid/Side). Phá vỡ đối sánh tương quan kênh đôi mà không làm méo giọng chính ở giữa. | Đặt **0 cents** cho âm thanh nguyên bản. |
| **Peak smear** | Các bộ lọc Peaking EQ có tần số trung tâm di chuyển liên tục theo thời gian. | Đặt **0 bands**. |
| **Sub-audio inject** | Chèn tần số hạ âm cực trầm (dưới 20 Hz) cùng độ lệch DC bias nhỏ. | Đặt **0 Hz**. |
| **Đảo & Dịch nhẹ 3 vùng (Đầu • Giữa • Cuối)** | Phân tích 3 vùng nhạy cảm của bài hát (Intro, Mid, Outro), áp dụng dịch chuyển thời gian vi mô (15-25ms) và đảo pha vi mô kênh Mid/Side với cửa sổ Hann 400ms. Phá vỡ hoàn toàn vân tay bản quyền Suno/Content ID mà vẫn giữ 100% chất âm nguyên bản sạch sẽ không méo tiếng. | Khuyên dùng chế độ **Nhẹ (Subtle)**. |

---

### 3. Cơ chế tải file an toàn 3 lớp (3-Tier Safe Download)
Được xây dựng theo quy chuẩn của skill `media-download-uuid-fix`:
1. **Lớp 1 (Permanent DOM Anchor)**: Nút tải file là thẻ `<a>` cố định trên giao diện, gắn sẵn thuộc tính `download="ten_file.wav"`, ngăn chặn hoàn toàn lỗi Chromium tự động lưu thành mã UUID không đuôi.
2. **Lớp 2 (Save As Dialog)**: Nút `Lưu vào thư mục mong muốn (Save As...)` kích hoạt `window.showSaveFilePicker` chuẩn của Windows.
3. **Lớp 3 (Filename Sanitizer)**: Tự động loại bỏ ký tự cấm, dấu chấm lửng `...`, chuẩn hóa UTF-8 an toàn tuyệt đối.

---

### 4. Tính năng Tải nhạc Suno AI (Suno Downloader)
- **Hỗ trợ link linh hoạt**: Dán 1 link hoặc dán danh sách hàng loạt link (mỗi dòng 1 link) từ `suno.com/song/[uuid]`, `suno.com/create?song=...`, `cdn1.suno.ai/[uuid].mp3` hoặc mã UUID bài hát.
- **Trích xuất trực tiếp CDN**: Trích xuất stream gốc chất lượng cao từ CloudFront CDN của Suno (`/1/clip/[uuid].m4a` / `.mp3`).
- **Định dạng tải về**: Tùy chọn xuất ra **MP3 Studio (320 kbps)** có gắn thẻ ID3 (Tiêu đề, Nghệ sĩ) hoặc **WAV Master (16-bit Lossless)**.
- **Tự động xử lý Anonymize**: Tùy chọn tự động nạp thẳng bài hát vừa tải từ Suno vào quy trình DSP làm sạch & đảo dịch 3 vùng rồi xuất ra file thành phẩm ngay lập tức.
- **Nạp vào hàng đợi**: Cho phép chuyển tiếp các bài hát Suno vào hàng đợi để kiểm tra và tinh chỉnh chi tiết trước khi xuất.

