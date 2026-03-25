# Use local MLX model in Cursor

Use this OpenAI-compatible endpoint and model in Cursor so chat uses your local Qwen coder model.

## Endpoint & model

| Setting | Value |
|--------|--------|
| **Base URL** | `http://192.168.0.3:8080/v1` |
| **Model** | `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` |

## Add to Cursor

1. Open **Cursor Settings** (⌘ + ,) → **Models**.
2. Under **OpenAI**, add an API key (local MLX servers often accept any placeholder, e.g. `sk-local`).
3. Turn **Override OpenAI Base URL** ON.
4. Set base URL to: `http://192.168.0.3:8080/v1`
5. **Add the model manually** (Cursor does not list models from your server):
   - Find the **“Add model”** or custom model input (under the same OpenAI section).
   - Type exactly: **`mlx-community/Qwen2.5-Coder-32B-Instruct-4bit`**
   - Press **Enter** (do **not** click the “Add” button — it often doesn’t work; Enter does).
6. Save. The model should appear in the chat model picker.

**If the model still doesn’t appear:** Try the short id your server reports. In a browser or terminal run:
`curl http://192.168.0.3:8080/v1/models`
and use the `id` from the response in the “Add model” field, then press Enter.

**If you see “This model does not support tools”:** Use **Ask** mode (not Agent), or start a **new chat** after switching to the Qwen model.

**Note:** Your MLX server must be running at `192.168.0.3:8080` and this machine must be on the same network. Tab completion may still use Cursor’s built-in models; custom keys apply to chat.
