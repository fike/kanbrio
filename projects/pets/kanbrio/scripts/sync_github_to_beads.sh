#!/bin/bash

# sync_github_to_beads.sh
# Sincroniza issues do GitHub para o sistema local Beads (bd)

echo "🔄 Sincronizando GitHub Issues com Beads local..."

# Busca issues abertas do GitHub no formato JSON
issues=$(gh issue list --state open --json number,title,labels --limit 50)

if [ -z "$issues" ] || [ "$issues" == "[]" ]; then
    echo "ℹ️ Nenhuma issue aberta encontrada no GitHub."
    exit 0
fi

# Itera sobre cada issue e cria no beads se não existir
echo "$issues" | jq -c '.[]' | while read -r issue; do
    number=$(echo "$issue" | jq -r '.number')
    title=$(echo "$issue" | jq -r '.title')
    
    # Verifica se a issue já existe localmente no bd (baseado no título para simplificar)
    if ! bd list | grep -q "$title"; then
        echo "➕ Criando issue local: #$number - $title"
        bd create "$title" -t task
    else
        echo "⏭️ Issue já existe: $title"
    fi
done

echo "✅ Sincronização concluída."
