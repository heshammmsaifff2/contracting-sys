import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  SaveSupplierDto,
  SupplierBankAccountDto,
  SupplierDto,
} from "@application/modules/procurement/dtos";
import type { ISupplierRepository } from "@application/modules/procurement/ports/supplier-repository";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface SupplierRowLike {
  id: string;
  code: string;
  name: string;
  contact: Json;
  is_active: boolean;
}

function readContact(contact: Json): {
  phone: string | null;
  email: string | null;
  address: string | null;
} {
  const record =
    typeof contact === "object" && contact !== null && !Array.isArray(contact)
      ? contact
      : {};

  const pick = (key: string): string | null => {
    const value = record[key];
    return typeof value === "string" && value !== "" ? value : null;
  };

  return { phone: pick("phone"), email: pick("email"), address: pick("address") };
}

function toDto(row: SupplierRowLike, bankAccountCount = 0): SupplierDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ...readContact(row.contact),
    isActive: row.is_active,
    bankAccountCount,
  };
}

function toContactJson(input: SaveSupplierDto): Json {
  return {
    ...(input.phone === null ? {} : { phone: input.phone }),
    ...(input.email === null ? {} : { email: input.email }),
    ...(input.address === null ? {} : { address: input.address }),
  };
}

const COLUMNS = "id, code, name, contact, is_active";

export class SupabaseSupplierRepository implements ISupplierRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** البحث في Postgres بالتطبيع العربي نفسه المستخدم للأصناف. */
  async search(
    query: string,
    limit = 50,
  ): Promise<Result<readonly SupplierDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("search_suppliers", {
        p_query: query,
        p_limit: limit,
      });

      if (error) return err(toDomainDbError(error, { entity: "الموردون" }));

      const rows = data ?? [];
      if (rows.length === 0) return ok([]);

      // عدد الحسابات البنكية لكل مورّد — استعلام واحد لا استعلام لكل صف
      const { data: accounts, error: accountsError } = await this.client
        .from("supplier_bank_accounts")
        .select("supplier_id")
        .in(
          "supplier_id",
          rows.map((row) => row.id),
        );

      if (accountsError)
        return err(toDomainDbError(accountsError, { entity: "حسابات الموردين" }));

      const countBySupplier = new Map<string, number>();
      for (const account of accounts ?? []) {
        countBySupplier.set(
          account.supplier_id,
          (countBySupplier.get(account.supplier_id) ?? 0) + 1,
        );
      }

      return ok(rows.map((row) => toDto(row, countBySupplier.get(row.id) ?? 0)));
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في الموردين"));
    }
  }

  async create(input: SaveSupplierDto): Promise<Result<SupplierDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("suppliers")
        .insert({
          code: input.code,
          name: input.name,
          contact: toContactJson(input),
          is_active: input.isActive,
        })
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "المورّد" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء المورّد"));
    }
  }

  async update(
    id: string,
    input: SaveSupplierDto,
  ): Promise<Result<SupplierDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("suppliers")
        .update({
          code: input.code,
          name: input.name,
          contact: toContactJson(input),
          is_active: input.isActive,
        })
        .eq("id", id)
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "المورّد", id }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل المورّد"));
    }
  }

  async listBankAccounts(
    supplierId: string,
  ): Promise<Result<readonly SupplierBankAccountDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("supplier_bank_accounts")
        .select("id, supplier_id, bank_name, account_no, iban, is_default")
        .eq("supplier_id", supplierId)
        .order("is_default", { ascending: false });

      if (error)
        return err(
          toDomainDbError(error, { entity: "حسابات المورّد", id: supplierId }),
        );

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          supplierId: row.supplier_id,
          bankName: row.bank_name,
          accountNo: row.account_no,
          iban: row.iban,
          isDefault: row.is_default,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حسابات المورّد"));
    }
  }

  async addBankAccount(
    input: Omit<SupplierBankAccountDto, "id">,
  ): Promise<Result<SupplierBankAccountDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("supplier_bank_accounts")
        .insert({
          supplier_id: input.supplierId,
          bank_name: input.bankName,
          account_no: input.accountNo,
          iban: input.iban,
          is_default: input.isDefault,
        })
        .select("id, supplier_id, bank_name, account_no, iban, is_default")
        .single();

      if (error) return err(toDomainDbError(error, { entity: "حساب المورّد" }));

      return ok({
        id: data.id,
        supplierId: data.supplier_id,
        bankName: data.bank_name,
        accountNo: data.account_no,
        iban: data.iban,
        isDefault: data.is_default,
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إضافة حساب المورّد"));
    }
  }

  async removeBankAccount(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("supplier_bank_accounts")
        .delete()
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "حساب المورّد", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف حساب المورّد"));
    }
  }
}
