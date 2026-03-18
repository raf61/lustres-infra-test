import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/**
 * Engine genérica para gerar documentos DOCX a partir de templates
 * Segue o princípio de inversão de dependência (o UseCase não conhece a lib)
 */
export class DocxEngine {
    /**
     * Renderiza um template DOCX com dados dinâmicos
     * @param templateBuffer O buffer do arquivo .docx original
     * @param data Objeto com as chaves e valores para interpolação
     * @returns Buffer do documento gerado
     */
    static render(templateBuffer: Buffer, data: Record<string, any>): Buffer {
        const zip = new PizZip(templateBuffer);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        try {
            doc.render(data);
        } catch (error) {
            console.error("Erro ao renderizar DOCX:", error);
            throw new Error("Falha na geração do documento DOCX.");
        }

        return doc.getZip().generate({ type: "nodebuffer" });
    }
}
