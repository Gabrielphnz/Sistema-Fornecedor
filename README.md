# Sistema-Fornecedor

Alinhar pontos: 
1 - Módulo de trocas, ainda não funcional. 
2 - Criar condicionamento para GerarPDF que, havendo troca ele imprima junto ao pedido. 
3 - Fazer o sistema funcionar o comparativo de preço (setinha pra cima vermelha (aumentou) setinha verde pra baixo (diminuiu)
4 - Melhorar a telinha dos pedidos, muito carente ainda do visual
5 - Uniformizar o CSS em todas as abas. 

---------------

Deixar em aberto para alinhar na quinta ao apresentar o sistema que novas implantações poderão ser feitas, contudo, com um custo leve. 

## Recuperar o commit com melhorias

Se algo ficou para trás após um merge com conflito, use este fluxo para recuperar o pacote de melhorias (`7f9bab6`):

1. Veja o histórico recente:
   - `git log --oneline --decorate -n 10`
2. Crie uma branch de segurança antes de ajustar:
   - `git checkout -b backup-antes-recuperacao`
3. Volte para a branch de trabalho:
   - `git checkout work`
4. Reaplique apenas o commit de melhorias:
   - `git cherry-pick 7f9bab6`
5. Se houver conflito, resolva no arquivo e finalize:
   - `git add Index.html Codigo.gs`
   - `git cherry-pick --continue`

Se você quiser voltar exatamente para o estado do merge que já continha as melhorias, use:

- `git reset --hard dffeca4`
