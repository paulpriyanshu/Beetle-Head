import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null) // ✅ New state for chosen image
  const [isUploading, setIsUploading] = useState(false) // ✅ State for upload progress
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null) // ✅ Ref for hidden file input

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage({
          file,
          preview: reader.result,
          base64: reader.result.split(',')[1]
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setSelectedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    let imageUrl = null;

    // ✅ Add message to UI immediately
    const userMessage = {
      role: "user",
      content: input,
      image: selectedImage?.preview
    };
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    const currentImage = selectedImage;

    setInput("");
    clearImage();
    setIsLoading(true);

    try {
      // 1. Upload image if exists
      if (currentImage) {
        setIsUploading(true);
        const uploadRes = await fetch("http://localhost:3000/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_data: currentImage.base64,
            filename: currentImage.file.name,
            file_type: currentImage.file.type
          }),
        });
        const uploadData = await uploadRes.json();
        if (uploadData.status === "success") {
          imageUrl = uploadData.file_url;
        }
        setIsUploading(false);
      }

      const payload = {
        model: "gemma3:4b",
        messages: [
          {
            role: "user",
            content: currentInput,
            images: currentImage ? [currentImage.base64] : undefined // Ollama expects base64
          },
        ],
        stream: true,
        image_url: imageUrl // Keep URL for reference if needed
      };

      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let aiText = "";
      let buffer = ""; // ✅ Buffer for partial JSON lines

      // ✅ create empty AI message first and start waiting
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);
      setIsWaiting(true);

      while (true) {
        const { done, value } = await reader.read();
        // console.log(done, JSON.parse(decoder.decode(value, { stream: true })).message.content)
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");

        // The last element of lines might be an incomplete JSON object
        // We keep it in the buffer for the next iteration
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            const token = json?.message?.content || "";

            if (token) {
              setIsWaiting(false); // ✅ Stop waiting on first token
              aiText += token;
            }

            // ✅ live update last AI message after EACH token for smoother UI
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "ai",
                content: aiText,
              };
              return updated;
            });
          } catch (e) {
            console.error("Partial JSON parse error:", e, line);
          }
        }
      }

      // Process any remaining data in buffer if it's a complete JSON
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          const token = json?.message?.content || "";
          if (token) {
            setIsWaiting(false);
            aiText += token;
          }
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "ai",
              content: aiText,
            };
            return updated;
          });
        } catch (e) {
          // Final part of buffer wasn't valid JSON, usually expected if it's just a trailing newline or similar
        }
      }
    } catch (error) {
      console.error("❌ Streaming error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Fallback: API unavailable." },
      ]);
    } finally {
      setIsLoading(false);
      setIsWaiting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={() => setMessages([])}>
          <span>+</span> New chat
        </button>
      </aside>

      <main className="main-chat">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h1>Beatle Head</h1>
            <div className="sub-empty-chat">
              <h1>Api playground</h1>
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-inner">
                  <div className={`avatar ${msg.role}`}>
                    {msg.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className="message-text">
                    {msg.image && (
                      <div className="message-image">
                        <img src={msg.image} alt="uploaded" />
                      </div>
                    )}
                    {msg.content}
                    {msg.role === 'ai' && isWaiting && index === messages.length - 1 && (
                      <div className="typing-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="input-container">
          {selectedImage && (
            <div className="image-preview-container">
              <div className="preview-wrapper">
                <img src={selectedImage.preview} alt="preview" />
                <button className="remove-image-btn" onClick={clearImage}>×</button>
              </div>
            </div>
          )}
          <div className="input-box">
            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
            />
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              rows="1"
              placeholder="Message ChatGPT..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || isLoading}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 11L12 6L17 11M12 18V7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
