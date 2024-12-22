
// Function: Display entity's component properties in a GUI
// Function to display properties in GUI
export function showPropertiesGUI(entity: Entity, gui: GUI) {
    const components = entity.getComponents();

    Object.entries(components).forEach(([componentName, componentInstance]) => {
        const className = componentInstance.constructor.name;
        //console.log('gui class:' + className);

        //get schema, static member of the type
        const BaseType = componentInstance.constructor as typeof Component;
        const schema = BaseType.schema;

        //add folder for each component
        const folder = gui.addFolder(className);

        for (const key in schema) {
            //type of schema
            const typedKey = key as keyof typeof schema;
            const fieldSchema = schema[typedKey];

            //if (componentInstance.hasOwnProperty(key)) { 

            if (fieldSchema.type === Types.JSON) {
                const subfolder = folder.addFolder(key);
                for (const subkey in fieldSchema.default) {
                    subfolder.add(componentInstance[key], subkey, fieldSchema.min, fieldSchema.max).name(subkey);
                }
            }
            else if (fieldSchema.type === Types.Boolean) {
                folder.add(componentInstance, key).name(key);
            }
            else if (fieldSchema.type === Types.Number) {
                folder.add(componentInstance, key, fieldSchema.min, fieldSchema.max).name(key);
            }
            else {
                console.log('gui unhandled:' + key);
            }

        };
    });

}




