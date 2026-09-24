# Aventura surpresa

Modo local de cinco etapas com revisão adaptativa, terrenos variados e eventos educativos.

- [x] Registrar respostas recentes por lição e perfil, com normalização e limpeza no reset.
- [x] Implementar seleção adaptativa e geração determinística reutilizando os templates existentes.
- [x] Integrar menu, cinco etapas, ajuda, descobertas, caminho bônus e resumo para responsáveis.
- [x] Verificar seleção, persistência, geometria com física real, fluxo completo e regressões.
- [x] Conferir navegador, tipos, build e documentar funcionamento e limites.

A adaptação usa regras locais; embeddings e criação por texto ficam para uma evolução posterior.

Verificação final: 625 testes em 75 arquivos, typecheck, build/PWA e diff sem erros.
Navegador: menu e fase em desktop e viewport 844×390; descoberta da abelha por eventos de teclado, sem erros de execução reportados.
