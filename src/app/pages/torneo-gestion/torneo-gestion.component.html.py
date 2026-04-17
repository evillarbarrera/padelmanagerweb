
def count_tags():
    with open('/Users/ejvillarb/Documents/privado Emmanuel Villar/proyectos/training_padel_academy/training_web/src/app/pages/torneo-gestion/torneo-gestion.component.html', 'r') as f:
        content = f.read()
    
    import re
    open_divs = len(re.findall(r'<div(?!\w)', content))
    close_divs = len(re.findall(r'</div\s*>', content))
    open_sections = len(re.findall(r'<section(?!\w)', content))
    close_sections = len(re.findall(r'</section\s*>', content))
    open_mains = len(re.findall(r'<main(?!\w)', content))
    close_mains = len(re.findall(r'</main\s*>', content))
    
    print(f"DIVs: {open_divs} open, {close_divs} close. Diff: {open_divs - close_divs}")
    print(f"SECTIONs: {open_sections} open, {close_sections} close. Diff: {open_sections - close_sections}")
    print(f"MAINs: {open_mains} open, {close_mains} close. Diff: {open_mains - close_mains}")

count_tags()
