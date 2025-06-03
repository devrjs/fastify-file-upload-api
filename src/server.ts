import Fastify, { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import path from "node:path";
import fs from "node:fs";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import { v4 as uuidv4 } from "uuid";

const pump = promisify(pipeline);

// Interfaces
interface UploadResponse {
  success: boolean;
  message: string;
  filename?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
  url?: string;
}

interface CertificateUploadResponse {
  success: boolean;
  message: string;
  filename?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
  expirationDate?: string;
  subject?: string;
  issuer?: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// Criar pastas se não existirem
const uploadsDir = path.join(__dirname, "../uploads");
const certificatesDir = path.join(__dirname, "../certificates");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

const buildServer = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === "development"
        ? {
            level: "info",
            transport: {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            },
          }
        : true,
  });

  // Registrar plugin de multipart para upload de arquivos
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limite
    },
  });

  // Registrar plugin de arquivos estáticos em um contexto isolado
  await fastify.register(async function (fastify) {
    await fastify.register(staticFiles, {
      root: uploadsDir,
      prefix: "/uploads/",
    });
  });

  // Registrar plugin de arquivos estáticos para certificados em outro contexto isolado
  await fastify.register(async function (fastify) {
    await fastify.register(staticFiles, {
      root: certificatesDir,
      prefix: "/certificates/",
      list: false,
    });
  });

  // Configurar Swagger
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "API de Upload de Imagens",
        description:
          "API para upload e gerenciamento de imagens usando Fastify e TypeScript",
        version: "1.0.0",
        contact: {
          name: "Suporte API",
          email: "suporte@exemplo.com",
        },
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Servidor de Desenvolvimento",
        },
      ],
    },
  });

  // Registrar Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "full",
      deepLinking: false,
      supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (csp) => csp,
    transformSpecification: (swaggerObject) => {
      // Configurar manualmente o upload de arquivo para o Swagger UI - IMAGENS
      if (
        swaggerObject.paths &&
        swaggerObject.paths["/upload"] &&
        swaggerObject.paths["/upload"].post
      ) {
        swaggerObject.paths["/upload"].post.requestBody = {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Selecione uma imagem (JPG, PNG, GIF)",
                  },
                },
                required: ["image"],
              },
            },
          },
        };
      }

      // Configurar manualmente o upload de certificado para o Swagger UI - CERTIFICADOS
      if (
        swaggerObject.paths &&
        swaggerObject.paths["/upload-certificate"] &&
        swaggerObject.paths["/upload-certificate"].post
      ) {
        swaggerObject.paths["/upload-certificate"].post.requestBody = {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  certificate: {
                    type: "string",
                    format: "binary",
                    description:
                      "Selecione um certificado digital (.pfx ou .p12)",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    description: "Digite a senha do certificado digital",
                  },
                },
                required: ["certificate", "password"],
              },
            },
          },
        };
      }

      return swaggerObject;
    },
  });

  // Rota de upload de imagem
  fastify.post<{
    Reply: UploadResponse | ErrorResponse;
  }>(
    "/upload",
    {
      schema: {
        tags: ["Upload"],
        summary: "Upload de imagem",
        description:
          'Faz upload de uma imagem (JPG, PNG, GIF) com tamanho máximo de 5MB. Use o campo "image" para enviar o arquivo.',
        consumes: ["multipart/form-data"],
        response: {
          200: {
            description: "Upload realizado com sucesso",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              filename: { type: "string" },
              originalName: { type: "string" },
              size: { type: "number" },
              mimetype: { type: "string" },
              url: { type: "string" },
            },
          },
          400: {
            description: "Erro na validação do arquivo",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Erro interno do servidor",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            error: "Arquivo não encontrado",
            message: "Nenhum arquivo foi enviado na requisição",
          });
        }

        // Validar tipo de arquivo
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
        ];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.code(400).send({
            error: "Tipo de arquivo inválido",
            message: "Apenas arquivos JPG, PNG e GIF são permitidos",
          });
        }

        // Gerar nome único para o arquivo
        const fileExtension = path.extname(data.filename);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadsDir, uniqueFilename);

        // Salvar arquivo
        await pump(data.file, fs.createWriteStream(filePath));

        // Obter informações do arquivo
        const stats = fs.statSync(filePath);

        const response: UploadResponse = {
          success: true,
          message: "Imagem enviada com sucesso",
          filename: uniqueFilename,
          originalName: data.filename,
          size: stats.size,
          mimetype: data.mimetype,
          url: `http://localhost:3000/uploads/${uniqueFilename}`,
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Ocorreu um erro ao processar o upload da imagem",
        });
      }
    }
  );

  // Rota para listar todas as imagens
  fastify.get(
    "/images",
    {
      schema: {
        tags: ["Imagens"],
        summary: "Listar todas as imagens",
        description: "Retorna uma lista de todas as imagens enviadas",
        response: {
          200: {
            description: "Lista de imagens",
            type: "object",
            properties: {
              images: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    filename: { type: "string" },
                    url: { type: "string" },
                    size: { type: "number" },
                  },
                },
              },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const files = fs.readdirSync(uploadsDir);
        const imageFiles = files.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return [".jpg", ".jpeg", ".png", ".gif"].includes(ext);
        });

        const images = imageFiles.map((filename) => {
          const filePath = path.join(uploadsDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            url: `http://localhost:3000/uploads/${filename}`,
            size: stats.size,
          };
        });

        return reply.send({
          images,
          total: images.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Erro ao listar imagens",
        });
      }
    }
  );

  // Rota para deletar uma imagem
  fastify.delete<{
    Params: { filename: string };
  }>(
    "/images/:filename",
    {
      schema: {
        tags: ["Imagens"],
        summary: "Deletar imagem",
        description: "Remove uma imagem específica do servidor",
        params: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Nome do arquivo da imagem",
            },
          },
          required: ["filename"],
        },
        response: {
          200: {
            description: "Imagem deletada com sucesso",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            description: "Imagem não encontrada",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { filename } = request.params;
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
          return reply.code(404).send({
            error: "Arquivo não encontrado",
            message: "A imagem especificada não existe",
          });
        }

        fs.unlinkSync(filePath);

        return reply.send({
          success: true,
          message: "Imagem deletada com sucesso",
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Erro ao deletar imagem",
        });
      }
    }
  );

  // Rota de upload de certificado PFX
  fastify.post<{
    Reply: CertificateUploadResponse | ErrorResponse;
  }>(
    "/upload-certificate",
    {
      schema: {
        tags: ["Certificados"],
        summary: "Upload de certificado digital",
        description:
          "Faz upload de um certificado digital (.pfx ou .p12) para emissão de notas fiscais. Requer senha do certificado.",
        consumes: ["multipart/form-data"],
        response: {
          200: {
            description: "Certificado enviado com sucesso",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              filename: { type: "string" },
              originalName: { type: "string" },
              size: { type: "number" },
              mimetype: { type: "string" },
              expirationDate: { type: "string" },
              subject: {
                type: "string",
                description: "Informações do titular do certificado",
              },
              issuer: {
                type: "string",
                description: "Autoridade certificadora",
              },
            },
          },
          400: {
            description: "Erro na validação do certificado",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Erro interno do servidor",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const parts = request.parts();
        let certificateFile: any = null;
        let password = "";

        // Processar multipart data
        for await (const part of parts) {
          if (part.type === "file" && part.fieldname === "certificate") {
            certificateFile = part;
          } else if (part.type === "field" && part.fieldname === "password") {
            password = part.value as string;
          }
        }

        if (!certificateFile) {
          return reply.code(400).send({
            error: "Certificado não encontrado",
            message: "Nenhum arquivo de certificado foi enviado na requisição",
          });
        }

        if (!password) {
          return reply.code(400).send({
            error: "Senha obrigatória",
            message: "A senha do certificado é obrigatória",
          });
        }

        // Validar extensão do arquivo
        const allowedExtensions = [".pfx", ".p12"];
        const fileExtension = path
          .extname(certificateFile.filename)
          .toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
          return reply.code(400).send({
            error: "Tipo de arquivo inválido",
            message:
              "Apenas arquivos .pfx e .p12 são permitidos para certificados digitais",
          });
        }

        // Validar tamanho do arquivo (máximo 5MB para certificados)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (certificateFile.file.readableLength > maxSize) {
          return reply.code(400).send({
            error: "Arquivo muito grande",
            message: "O certificado deve ter no máximo 5MB",
          });
        }

        // Gerar nome único para o certificado
        const uniqueFilename = `cert_${uuidv4()}${fileExtension}`;
        const filePath = path.join(certificatesDir, uniqueFilename);

        // Salvar certificado
        await pump(certificateFile.file, fs.createWriteStream(filePath));

        // Obter informações do arquivo
        const stats = fs.statSync(filePath);

        // Simular extração de informações do certificado (em produção, use uma biblioteca como node-forge)
        const mockCertInfo = {
          expirationDate: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(), // +1 ano
          subject: "CN=Empresa Exemplo, O=Empresa Exemplo LTDA",
          issuer: "CN=AC Exemplo, O=Autoridade Certificadora Exemplo",
        };

        const response: CertificateUploadResponse = {
          success: true,
          message: "Certificado digital enviado e validado com sucesso",
          filename: uniqueFilename,
          originalName: certificateFile.filename,
          size: stats.size,
          mimetype: certificateFile.mimetype,
          expirationDate: mockCertInfo.expirationDate,
          subject: mockCertInfo.subject,
          issuer: mockCertInfo.issuer,
        };

        // Log de segurança (não incluir senha)
        fastify.log.info(
          {
            action: "certificate_upload",
            filename: uniqueFilename,
            originalName: certificateFile.filename,
            size: stats.size,
            subject: mockCertInfo.subject,
          },
          "Certificado digital enviado com sucesso"
        );

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Ocorreu um erro ao processar o upload do certificado",
        });
      }
    }
  );

  // Rota para listar certificados (informações básicas por segurança)
  fastify.get(
    "/certificates",
    {
      schema: {
        tags: ["Certificados"],
        summary: "Listar certificados digitais",
        description:
          "Retorna uma lista básica de certificados digitais enviados (sem informações sensíveis)",
        response: {
          200: {
            description: "Lista de certificados",
            type: "object",
            properties: {
              certificates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    size: { type: "number" },
                    uploadDate: { type: "string" },
                    subject: { type: "string" },
                    expirationDate: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["active", "expired", "expiring_soon"],
                    },
                  },
                },
              },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const files = fs.readdirSync(certificatesDir);
        const certificateFiles = files.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return [".pfx", ".p12"].includes(ext);
        });

        const certificates = certificateFiles.map((filename) => {
          const filePath = path.join(certificatesDir, filename);
          const stats = fs.statSync(filePath);

          // Simular informações do certificado (em produção, extrair do arquivo real)
          const mockExpirationDate = new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          );
          const now = new Date();
          const daysUntilExpiration = Math.ceil(
            (mockExpirationDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          let status: "active" | "expired" | "expiring_soon" = "active";
          if (daysUntilExpiration < 0) {
            status = "expired";
          } else if (daysUntilExpiration <= 30) {
            status = "expiring_soon";
          }

          return {
            filename,
            originalName: filename.replace(/^cert_[a-f0-9-]+_/, ""), // Remove prefixo UUID
            size: stats.size,
            uploadDate: stats.birthtime.toISOString(),
            subject: "CN=Empresa Exemplo, O=Empresa Exemplo LTDA",
            expirationDate: mockExpirationDate.toISOString(),
            status,
          };
        });

        return reply.send({
          certificates,
          total: certificates.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Erro ao listar certificados",
        });
      }
    }
  );

  // Rota para deletar um certificado
  fastify.delete<{
    Params: { filename: string };
  }>(
    "/certificates/:filename",
    {
      schema: {
        tags: ["Certificados"],
        summary: "Deletar certificado digital",
        description:
          "Remove um certificado digital específico do servidor (CUIDADO: operação irreversível)",
        params: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Nome do arquivo do certificado",
            },
          },
          required: ["filename"],
        },
        response: {
          200: {
            description: "Certificado deletado com sucesso",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            description: "Certificado não encontrado",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { filename } = request.params;
        const filePath = path.join(certificatesDir, filename);

        if (!fs.existsSync(filePath)) {
          return reply.code(404).send({
            error: "Certificado não encontrado",
            message: "O certificado especificado não existe",
          });
        }

        // Validar se é realmente um certificado
        const fileExtension = path.extname(filename).toLowerCase();
        if (![".pfx", ".p12"].includes(fileExtension)) {
          return reply.code(400).send({
            error: "Arquivo inválido",
            message:
              "Apenas certificados .pfx e .p12 podem ser deletados por esta rota",
          });
        }

        fs.unlinkSync(filePath);

        // Log de segurança
        fastify.log.warn(
          {
            action: "certificate_deleted",
            filename: filename,
          },
          "Certificado digital deletado"
        );

        return reply.send({
          success: true,
          message: "Certificado digital deletado com sucesso",
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Erro interno do servidor",
          message: "Erro ao deletar certificado",
        });
      }
    }
  );

  // Rota de status da API
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Sistema"],
        summary: "Status da API",
        description: "Verifica se a API está funcionando corretamente",
        response: {
          200: {
            description: "API funcionando",
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }
  );

  return fastify;
};

// Inicializar servidor
const start = async (): Promise<void> => {
  try {
    const fastify = await buildServer();

    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });

    console.log("🚀 Servidor iniciado com sucesso!");
    console.log(`📡 API rodando em: http://localhost:${port}`);
    console.log(`📚 Documentação Swagger: http://localhost:${port}/docs`);
    console.log(`🖼️  Pasta de uploads: ${uploadsDir}`);
  } catch (err) {
    console.error("❌ Erro ao iniciar servidor:", err);
    process.exit(1);
  }
};

// Iniciar apenas se executado diretamente
if (require.main === module) {
  start();
}

export { buildServer };
