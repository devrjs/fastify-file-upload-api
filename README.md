# API de Upload de Arquivos

Uma API robusta construída com Node.js, TypeScript, Fastify e Swagger para upload e gerenciamento de imagens.

## 🚀 Funcionalidades

- **Upload de Imagens**: Envie imagens (JPG, PNG, GIF) até 5MB
- **Documentação Swagger**: Interface interativa para testar a API
- **Listagem de Imagens**: Visualize todas as imagens enviadas
- **Exclusão de Imagens**: Remove imagens do servidor
- **Validação de Arquivos**: Apenas tipos de imagem permitidos
- **Nomes Únicos**: Geração automática de nomes únicos para evitar conflitos
- **Servir Arquivos Estáticos**: Acesso direto às imagens via URL

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

## 🛠️ Instalação

1. **Clone ou crie o projeto:**

```bash
mkdir fastify-file-upload-api
cd fastify-file-upload-api
```

2. **Instale as dependências:**

```bash
npm install
```

3. **Compile o TypeScript:**

```bash
npm run build
```

4. **Inicie o servidor:**

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo produção
npm start
```

## 📡 Endpoints da API

### 🔄 Status da API

- **GET** `/health` - Verifica o status da API

### 📤 Upload de Imagens

- **POST** `/upload` - Faz upload de uma imagem
  - **Body**: `multipart/form-data` com campo `image`
  - **Tipos aceitos**: JPG, PNG, GIF
  - **Tamanho máximo**: 5MB

### 📋 Gerenciamento de Imagens

- **GET** `/images` - Lista todas as imagens enviadas
- **DELETE** `/images/:filename` - Remove uma imagem específica

### 🖼️ Acesso às Imagens

- **GET** `/uploads/:filename` - Acessa diretamente uma imagem

## 📚 Documentação Swagger

Após iniciar o servidor, acesse a documentação interativa em:
**http://localhost:3000/docs**

Na documentação você encontrará:

- Interface para testar todos os endpoints
- **Botão "Choose File"** na rota de upload para selecionar imagens
- Esquemas de dados detalhados
- Exemplos de resposta

## 🗂️ Estrutura do Projeto

```
fastify-image-upload-api/
├── src/
│   └── server.ts          # Servidor principal
├── dist/                  # Código compilado (gerado)
├── uploads/               # Imagens enviadas (criado automaticamente)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia servidor em modo desenvolvimento com hot reload
- `npm run build` - Compila o código TypeScript
- `npm start` - Inicia servidor em modo produção
- `npm run type-check` - Verifica tipos TypeScript

## 🌐 URLs Importantes

Após iniciar o servidor (porta padrão 3000):

- **API Base**: http://localhost:3000
- **Documentação Swagger**: http://localhost:3000/docs
- **Status da API**: http://localhost:3000/health
- **Upload de Imagem**: http://localhost:3000/upload
- **Listar Imagens**: http://localhost:3000/images

## 📝 Como Usar

### 1. Upload via Swagger UI

1. Acesse http://localhost:3000/docs
2. Encontre a rota **POST /upload**
3. Clique em **"Try it out"**
4. Use o botão **"Choose File"** para selecionar uma imagem
5. Clique em **"Execute"** para fazer o upload

### 2. Upload via cURL

```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@caminho/para/sua/imagem.jpg"
```

### 3. Upload via JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append("image", fileInput.files[0]);

fetch("http://localhost:3000/upload", {
  method: "POST",
  body: formData,
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

## 🔒 Validações e Limites

- **Tipos de arquivo permitidos**: JPG, JPEG, PNG, GIF
- **Tamanho máximo**: 5MB por arquivo
- **Nomes únicos**: Gerados automaticamente com UUID
- **Validação de tipo MIME**: Verificação do tipo real do arquivo

## 🚨 Tratamento de Erros

A API retorna erros estruturados:

```json
{
  "error": "Tipo de erro",
  "message": "Descrição detalhada do erro"
}
```

Códigos de status HTTP utilizados:

- **200**: Sucesso
- **400**: Erro de validação (arquivo inválido)
- **404**: Recurso não encontrado
- **500**: Erro interno do servidor

## 🔧 Configuração

Variáveis de ambiente opcionais:

- `PORT`: Porta do servidor (padrão: 3000)
- `HOST`: Host do servidor (padrão: 0.0.0.0)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT - veja o arquivo LICENSE para detalhes.
