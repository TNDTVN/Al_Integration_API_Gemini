from flask import Flask, render_template, request, jsonify, session, Response
import google.generativeai as genai
import os
import traceback

app = Flask(__name__)
app.secret_key = 'super_secret_key'  # Để lưu session

# API key từ Google AI Studio
# Thay bằng key hợp lệ
API_KEY = os.getenv(
    "GOOGLE_API_KEY", "AIzaSyChvKPKEYs5aua4sfByBHq3sPopBbg38IQ")
genai.configure(api_key=API_KEY)

# System prompt cho chủ đề AI Integration với thay đổi về Gemini API
system_prompt = """
Bạn là trợ lý tư vấn về AI Integration. Hãy giải thích rõ ràng, ngắn gọn bằng tiếng Việt các khái niệm liên quan như:
- Basic Ollama model integration: Tích hợp mô hình Ollama cơ bản.
- Prompt engineering fundamentals: Nguyên tắc cơ bản về kỹ thuật viết prompt.
- AI safety considerations cơ bản: Các lưu ý an toàn AI cơ bản (như bias, hallucination).
- Cost management cho AI services: Quản lý chi phí dịch vụ AI (ví dụ: token usage, chọn model rẻ).
- Tích hợp Gemini API cơ bản: Tích hợp Gemini API đơn giản.
- Các chủ đề khác như Simple chatbot implementation, Semantic Kernel introduction, hoặc bất kỳ câu hỏi liên quan đến AI Integration.
Trả lời dựa trên kiến thức chung, giữ ngắn gọn và hữu ích. Nếu câu hỏi không liên quan, lịch sự từ chối.
"""


@app.route('/')
def index():
    # Xóa session messages để làm mới lịch sử chat khi refresh
    session.pop('messages', None)
    # Khởi tạo session messages mới
    session['messages'] = [{"role": "system", "content": system_prompt}]
    # Truyền lịch sử messages (bỏ system prompt) cho template
    history = session['messages'][1:]
    return render_template('index.html', history=history)


@app.route('/chat', methods=['POST'])
def chat():
    prompt = request.json.get('prompt')
    if not prompt:
        print("Error: No prompt provided")  # Log lỗi
        return jsonify({'error': 'No prompt provided'}), 400

    # Thêm user message vào session
    session['messages'].append({"role": "user", "content": prompt})
    session.modified = True

    # Copy messages để sử dụng
    messages_copy = session['messages'][:]

    try:
        # Chuẩn bị client và gọi Gemini API với stream=True
        client = genai.GenerativeModel(
            model_name="gemini-1.5-flash",  # Sử dụng model mới nhất
            generation_config={
                "temperature": 0.7,
                "top_p": 0.9,
                "max_output_tokens": 2048
            }
        )

        # Chuyển messages sang định dạng của genai
        contents = [
            {"parts": [{"text": msg["content"]}],
             "role": "user" if msg["role"] == "user" else "model"}
            for msg in messages_copy
        ]

        # Gọi API với stream=True
        response_stream = client.generate_content(contents, stream=True)

        # Biến để tích lũy full response
        full_response = ""

        def generate_response():
            nonlocal full_response
            try:
                for chunk in response_stream:
                    content = chunk.text if hasattr(chunk, 'text') else ''
                    if not content and hasattr(chunk, 'candidates') and chunk.candidates:
                        try:
                            content = chunk.candidates[0].content.parts[0].text
                        except (IndexError, AttributeError) as e:
                            print(f"Error extracting candidate text: {e}")
                            content = ''
                    if content:
                        full_response += content
                        yield content.encode('utf-8')
                    else:
                        print(f"Chunk không có text: {chunk}")
            except Exception as e:
                print(f"Lỗi khi stream từ Gemini API: {str(e)}")
                yield f"[Lỗi: {str(e)}]".encode('utf-8')

        # Tạo Response từ generator
        response = Response(generate_response(), mimetype='text/plain')

        # Lưu full_response vào session sau khi stream hoàn tất
        def save_session():
            with app.test_request_context():
                if 'messages' not in session:
                    session['messages'] = [
                        {"role": "system", "content": system_prompt}]
                session['messages'].append(
                    {"role": "assistant", "content": full_response})
                session.modified = True

        response.call_on_close(save_session)
        return response

    except Exception as e:
        print(f"Lỗi kết nối Gemini API: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Lỗi kết nối server: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=False)  # Tắt debug cho production
