-- AlterTable
CREATE SEQUENCE comissao_id_seq;
ALTER TABLE "Comissao" ALTER COLUMN "id" SET DEFAULT nextval('comissao_id_seq');
ALTER SEQUENCE comissao_id_seq OWNED BY "Comissao"."id";
