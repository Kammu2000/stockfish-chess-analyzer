export const EMPTY_OBJECT_READONLY = {};

export const insertIfObj = (condition: boolean, obj: Record<string, any>): Record<string, any> => {
    return condition ? obj : EMPTY_OBJECT_READONLY;
};
