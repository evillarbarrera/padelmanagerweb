
import sys

def check_html_balance(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    tags = []
    import re
    # Match <tag or </tag>
    all_tags = re.findall(r'<(/?[a-zA-Z0-9-]+)[^>]*>', content)
    
    stack = []
    for tag in all_tags:
        if tag.startswith('/'):
            tag_name = tag[1:]
            if not stack:
                print(f"Unexpected closing tag: {tag}")
                continue
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Mismatch: opened {last_tag}, closed {tag_name}")
                # Don't return, keep going to find more
        else:
            # Skip self-closing tags like img, input, br, hr, meta, link
            if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'app-sidebar']:
                continue
            stack.append(tag)
    
    if stack:
        print(f"Unclosed tags: {stack}")
    else:
        print("All tags balanced!")

if __name__ == "__main__":
    check_html_balance(sys.argv[1])
