import os
import re

directory = "/Users/ejvillarb/Documents/privado Emmanuel Villar/proyectos/training_padel_academy/training_web/src/app/pages"
pattern = re.compile(r'\s*<!-- Top Header -->\s*<header class="top-header">.*?</header>', re.DOTALL)
pattern2 = re.compile(r'\s*<header class="top-header">.*?</header>', re.DOTALL)

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()

            new_content = pattern.sub('', content)
            new_content = pattern2.sub('', new_content)

            if new_content != content:
                print(f"Removed header from {filepath}")
                with open(filepath, "w") as f:
                    f.write(new_content)
