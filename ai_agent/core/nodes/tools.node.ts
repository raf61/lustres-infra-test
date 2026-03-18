import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools";

export const toolNode = new ToolNode(tools);
