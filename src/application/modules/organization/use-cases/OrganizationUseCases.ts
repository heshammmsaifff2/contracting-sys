/**
 * الأقسام والوظائف.
 *
 * منع الحذف مكتوبٌ مرّتين عمدًا: هنا ليُقال للمستخدم **لماذا** قبل أن يضغط،
 * وفي مُشغّلات القاعدة لأن الواجهة ليست حارسًا — قد يُحذف من شاشة أخرى أو
 * بين قراءة القائمة والضغط.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { EMPLOYEE_TYPES } from "@core/modules/identity/entities/Profile";
import type { UseCase } from "@application/shared/use-case";
import type {
  AttachmentAccessDto,
  AttachmentAccessEntry,
  DepartmentDto,
  JobDto,
  SaveDepartmentInput,
  SaveJobInput,
} from "../dtos";
import type { IOrganizationRepository } from "../ports/organization-repository";

/** سبب منع حذف القسم، أو null إن جاز. */
export function departmentDeleteBlock(department: DepartmentDto): string | null {
  if (department.jobs.length > 0) {
    return `لا يُحذف القسم «${department.name}»: فيه ${department.jobs.length} وظيفة — احذف وظائفه أوّلًا`;
  }
  if (department.employeeCount > 0) {
    return `لا يُحذف القسم «${department.name}»: فيه ${department.employeeCount} موظف — انقلهم أوّلًا`;
  }
  return null;
}

/** سبب منع حذف الوظيفة، أو null إن جاز. */
export function jobDeleteBlock(job: JobDto): string | null {
  return job.holderCount > 0
    ? `لا تُحذف الوظيفة «${job.name}»: يشغلها ${job.holderCount} موظف — انقلهم إلى وظيفة أخرى أوّلًا`
    : null;
}

export class ListDepartments implements UseCase<void, readonly DepartmentDto[]> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly DepartmentDto[], DomainError>> {
    return this.repo.listDepartments();
  }
}

export class ListAttachmentAccess implements UseCase<
  string,
  readonly AttachmentAccessDto[]
> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(
    departmentId: string,
  ): Promise<Result<readonly AttachmentAccessDto[], DomainError>> {
    return this.repo.listAttachmentAccess(departmentId);
  }
}

export class SaveDepartment implements UseCase<SaveDepartmentInput, string> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(input: SaveDepartmentInput): Promise<Result<string, DomainError>> {
    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم القسم مطلوب", { name: "required" }));
    }
    if (!EMPLOYEE_TYPES.includes(input.classification)) {
      return err(
        new ValidationError("التصنيف إمّا إداري أو تشغيلي", {
          classification: "invalid",
        }),
      );
    }

    // المكرّر يُطوى، والناقص يُسقط، والقسم لا يُستثنى من نفسه
    const seen = new Set<string>();
    const access: AttachmentAccessEntry[] = [];
    if (input.restrictAttachments) {
      for (const entry of input.access) {
        const target = entry.kind === "user" ? entry.userId : entry.departmentId;
        if (target === null || target === "") continue;
        if (entry.kind === "department" && target === input.id) {
          return err(
            new ValidationError(
              "القسم لا يُستثنى من نفسه — موظفوه يرون مرفقاته دائمًا",
              {
                access: "self",
              },
            ),
          );
        }
        const key = `${entry.kind}:${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        access.push(
          entry.kind === "user"
            ? { kind: "user", userId: target, departmentId: null }
            : { kind: "department", userId: null, departmentId: target },
        );
      }
    }

    return this.repo.saveDepartment({
      ...input,
      name,
      description: input.description.trim(),
      access,
    });
  }
}

export class DeleteDepartment implements UseCase<{ id: string }, void> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    const departments = await this.repo.listDepartments();
    if (!departments.ok) return departments;

    const department = departments.value.find((d) => d.id === input.id);
    if (department === undefined) {
      return err(new NotFoundError("القسم", input.id));
    }
    const blocked = departmentDeleteBlock(department);
    if (blocked !== null) {
      return err(new ConflictError(blocked, { entity: "القسم" }));
    }
    return this.repo.deleteDepartment(input.id);
  }
}

export class SaveJob implements UseCase<SaveJobInput, string> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(input: SaveJobInput): Promise<Result<string, DomainError>> {
    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم الوظيفة مطلوب", { name: "required" }));
    }
    if (input.departmentId === "") {
      return err(new ValidationError("اختر قسم الوظيفة", { departmentId: "required" }));
    }
    if (input.roleId === "") {
      return err(
        new ValidationError("اختر صلاحيات الوظيفة — بغيرها لا يرى شاغلها شيئًا", {
          roleId: "required",
        }),
      );
    }
    return this.repo.saveJob({ ...input, name, description: input.description.trim() });
  }
}

export class DeleteJob implements UseCase<{ id: string }, void> {
  private readonly repo: IOrganizationRepository;

  constructor(repo: IOrganizationRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    const departments = await this.repo.listDepartments();
    if (!departments.ok) return departments;

    const job = departments.value.flatMap((d) => d.jobs).find((j) => j.id === input.id);
    if (job === undefined) {
      return err(new NotFoundError("الوظيفة", input.id));
    }
    const blocked = jobDeleteBlock(job);
    if (blocked !== null) {
      return err(new ConflictError(blocked, { entity: "الوظيفة" }));
    }
    return this.repo.deleteJob(input.id);
  }
}
