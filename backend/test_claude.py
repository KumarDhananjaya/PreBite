"""Run manually to verify your configured Claude account; never called by pytest."""
from anthropic import Anthropic
from app.core.config import get_settings


def main():
    settings = get_settings()
    client = Anthropic(api_key=settings.claude_api_key, timeout=60.0)
    response = client.messages.create(model=settings.claude_model, max_tokens=100,
        messages=[{"role": "user", "content": "Reply with: PreBite Claude connection successful"}])
    for block in response.content:
        if block.type == "text":
            print(block.text)


if __name__ == "__main__":
    main()
