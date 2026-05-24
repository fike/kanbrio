#!/bin/bash

# sync_github_to_beads.sh
# Sincroniza issues do GitHub para o sistema local Beads (bd)
# Fonte da verdade: GitHub

echo "🔄 Sincronizando GitHub Issues com Beads local..."

# 1. Busca TODAS as issues (open e closed) do GitHub
echo "📥 Buscando issues do GitHub..."
gh_issues=$(gh issue list --state all --json number,title,state --limit 100)

if [ -z "$gh_issues" ] || [ "$gh_issues" == "[]" ]; then
    echo "ℹ️ Nenhuma issue encontrada no GitHub."
    exit 0
fi

# 2. Processa cada issue do GitHub
echo "$gh_issues" | jq -c '.[]' | while read -r issue; do
    number=$(echo "$issue" | jq -r '.number')
    title=$(echo "$issue" | jq -r '.title')
    state=$(echo "$issue" | jq -r '.state')
    
    # Pega a lista local atualizada a cada iteração para evitar inconsistências
    bd_list=$(bd list)
    
    # Tenta encontrar os IDs locais baseados no título (pode haver duplicatas)
    # Usamos grep -F para busca literal e extraímos apenas a parte que contém o status e o ID
    local_matches=$(echo "$bd_list" | grep -F "$title")
    
    if [ -z "$local_matches" ]; then
        # Issue não existe localmente
        if [ "$state" == "OPEN" ]; then
            echo "➕ Criando issue local: #$number - $title"
            bd create "$title" -t task
        fi
    else
        # Processa cada match (lida com duplicatas)
        echo "$local_matches" | while read -r match_line; do
            local_id=$(echo "$match_line" | awk '{print $2}')
            local_status_icon=$(echo "$match_line" | awk '{print $1}')
            
            if [ "$state" == "CLOSED" ] && [ "$local_status_icon" == "○" ]; then
                echo "✅ Fechando issue local: $local_id (#$number - $title)"
                bd close "$local_id"
            elif [ "$state" == "OPEN" ] && [ "$local_status_icon" == "✓" ]; then
                # Se a issue está aberta no GH mas fechada no Beads, o Beads não tem 'reopen'
                # mas podemos avisar.
                echo "⚠️ Issue #$number está aberta no GH mas fechada no Beads ($local_id)."
            fi
        done
    fi
done

echo "🏁 Sincronização concluída."
