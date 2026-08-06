export interface TeamRole {
    readonly id: string;
    readonly name: string;
}
export interface RoleCreator {
    create(options: {
        name: string;
        colors: {
            primaryColor: number;
        };
        reason: string;
    }): Promise<TeamRole>;
}
export interface EditableRole {
    readonly name: string;
    setName(name: string): Promise<unknown>;
    delete(reason: string): Promise<unknown>;
}
export interface MemberRoleEditor {
    add(roleId: string): Promise<unknown>;
    remove(roleId: string): Promise<unknown>;
}
export declare function parseTeamRoleColor(hex: string | null): number | null;
export declare function createTeamRole(roleCreator: RoleCreator, input: Readonly<{
    name: string;
    color: number;
    createdBy: string;
}>): Promise<TeamRole>;
export declare function renameTeamRole(role: EditableRole, newName: string): Promise<void>;
export declare function deleteTeamRole(role: EditableRole): Promise<void>;
export declare function addMemberToTeamRole(memberRoles: MemberRoleEditor, roleId: string): Promise<void>;
export declare function removeMemberFromTeamRole(memberRoles: MemberRoleEditor, roleId: string): Promise<void>;
//# sourceMappingURL=role-service.d.ts.map