/*
 * Copyright (c) 2016-2017 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
const shell = require('shelljs');

shell.exec('mkdir -p src/assets/swagger-ui;');
shell.exec('cp -r ./node_modules/swagger-ui/dist/* ./src/assets/swagger-ui');
shell.exec('cp ./node_modules/clarity-ui/clarity-ui.min.css ./src/assets; cp ./node_modules/clarity-icons/clarity-icons.min.css ./src/assets');
shell.exec('cp ./node_modules/apix-components/assets/* ./src/assets');
