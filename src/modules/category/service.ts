import { MedusaService } from "@medusajs/framework/utils"
import { Category } from "./models/category"

export default class CategoryModuleService extends MedusaService({
    Category,
}) { }
