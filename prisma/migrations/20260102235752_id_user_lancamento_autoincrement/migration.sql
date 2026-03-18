-- AlterTable
CREATE SEQUENCE userlancamento_id_seq;
ALTER TABLE "UserLancamento" ALTER COLUMN "id" SET DEFAULT nextval('userlancamento_id_seq');
ALTER SEQUENCE userlancamento_id_seq OWNED BY "UserLancamento"."id";
