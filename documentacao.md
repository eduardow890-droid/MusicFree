# Documentação do sistema Music

## Visão geral
Este projeto foi pensado para uso simples em ambiente pequeno, com até duas pessoas compartilhando um mesmo sistema de biblioteca musical.

A estrutura atual mantém o projeto leve: um backend em Node.js + Express, um frontend estático e o armazenamento em Supabase.

## Objetivo do modelo atual
- permitir o uso de duas pessoas com autenticação simples
- manter uma biblioteca musical compartilhada entre os usuários
- registrar o autor de cada upload
- permitir que somente o autor exclua a própria música
- manter baixa complexidade para manutenção futura

## Fluxo de autenticação
O sistema usa:
- header `x-app-user`
- header `x-app-password`

Os usuários definidos por padrão são:
- `usuario1`
- `usuario2`

As credenciais devem ser configuradas no arquivo `.env`:

```env
USER_1_NAME=usuario1
USER_1_PASSWORD=sua_senha_1
USER_2_NAME=usuario2
USER_2_PASSWORD=sua_senha_2
```

Se `APP_PASSWORD` estiver configurado, ele pode funcionar como senha global de emergência.

## Regras de negócio
- cada música deve ficar vinculada ao usuário que a enviou
- a listagem de músicas deve devolver as músicas dos dois usuários
- um usuário pode ouvir as músicas enviadas pelo outro usuário
- um usuário não deve conseguir excluir a música do outro usuário
- cada usuário poderá montar suas próprias playlists a partir da biblioteca compartilhada

## Estrutura de dados esperada
A tabela `musicas` no Supabase deve incluir, no mínimo:
- `id`
- `titulo`
- `artista`
- `genero`
- `url_audio`
- `duracao_segundos`
- `capa_url`
- `usuario`

## Pontos importantes para manutenção
1. Não aumentar a complexidade sem necessidade.
2. Manter nomes e chaves consistentes entre frontend e backend.
3. Quando o sistema crescer, a próxima evolução recomendada é substituir autenticação simples por login real com sessão ou token.
4. Quando houver mais de 2 usuários, o modelo atual deve ser revisado para suporte por perfil ou base de usuários.

## Próximas melhorias possíveis
- login com usuário e senha reais
- sessões com token JWT
- painel de administração para trocar senhas
- organização por playlists
- upload de capas manualmente
- filtro por gênero ou artista

## Checklist para atualização futura
- revisar `.env`
- confirmar usuários no backend
- confirmar que o frontend envia `x-app-user`
- confirmar que o backend filtra por `usuario`
- validar que exclusão continua respeitando o usuário autor da música

## Observação
Este modelo é simples e funcional para duas pessoas, sem introduzir infraestrutura pesada. Ele foi desenhado para facilitar futuras evoluções sem reescrever tudo do zero.
