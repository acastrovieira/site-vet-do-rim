#!/usr/bin/env python3
"""
check_workspace.py — Auditor de Conformidade AIOX

Verifica se o repositório atual possui a estrutura e arquivos fundamentais
exigidos pela AIOX Constitution para sessões de vibe coding.
"""

import sys
import argparse
from pathlib import Path

def audit_workspace(project_path_str: str) -> bool:
    project_path = Path(project_path_str).resolve()
    print(f"🔍 Auditando conformidade AIOX no diretório: {project_path}\n")
    
    if not project_path.exists() or not project_path.is_dir():
        print(f"❌ Erro: Caminho não encontrado ou não é diretório: {project_path}")
        return False

    checks = {
        ".aiox-core (Pasta Core)": project_path / ".aiox-core",
        "AIOX Constitution (.aiox-core/constitution.md)": project_path / ".aiox-core" / "constitution.md",
        "Catálogo de Agentes (AGENTS.md)": project_path / "AGENTS.md",
        "Documentação de Requisitos (docs/prd.md ou docs/prd)": [project_path / "docs" / "prd.md", project_path / "docs" / "prd"],
        "Histórico de Histórias (docs/stories)": project_path / "docs" / "stories"
    }

    issues_found = 0
    
    for label, path in checks.items():
        if isinstance(path, list):
            # Se for uma lista de caminhos alternativos
            exists = any(p.exists() for p in path)
            detail = " ou ".join(str(p.relative_to(project_path)) for p in path)
        else:
            exists = path.exists()
            detail = str(path.relative_to(project_path))

        if exists:
            print(f"  ✅ [PRESENTE] {label} ({detail})")
        else:
            print(f"  ❌ [FALTANDO] {label} ({detail})")
            issues_found += 1

    print(f"\n{'='*60}")
    if issues_found == 0:
        print("🎉 EXCELENTE! O workspace está 100% em conformidade com as regras AIOX.")
        print(f"{'='*60}\n")
        return True
    else:
        print(f"⚠️  ATENÇÃO: Foram encontrados {issues_found} item(ns) pendente(s).")
        print("Adapte a estrutura do workspace para garantir o funcionamento pleno das skills.")
        print(f"{'='*60}\n")
        return False

def main():
    parser = argparse.ArgumentParser(description="Audita a conformidade de estrutura AIOX de um repositório.")
    parser.add_argument("project_path", nargs="?", default=".", help="Caminho para o projeto (padrão: '.')")
    args = parser.parse_args()
    
    success = audit_workspace(args.project_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
