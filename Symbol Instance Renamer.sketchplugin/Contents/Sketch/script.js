var sketch = require("sketch");

var strPluginName = "Symbol Instance Renamer",
	strRenameSuccess = " symbol instances have been renamed",
	strRenameFailure = "Select at least one symbol instance to rename.",
	strRenameFailureArtboard = "Select at least one artboard for which to rename instances.",
	strRenameFailureSymbol = "Select at least one symbol master for which to rename instances.",
	strRenameFailureString = "Provide a new name for the selected instances.",
	debugMode = false;

var renameEverything = function(context) {
	var pages = context.document.pages(),
		pageLoop = pages.objectEnumerator(),
		page,
		count = 0;

	while (page = pageLoop.nextObject()) {
		count = count + renameObjectInstances(page);
	}

	sketch.UI.message(count + strRenameSuccess);

	if (!debugMode) googleAnalytics(context,"rename","everything");
}

var renamePages = function(context) {
	var pages = context.document.pages(),
		pageLoop = pages.objectEnumerator(),
		page,
		count = 0;

	while (page = pageLoop.nextObject()) {
		if (page != context.document.documentData().symbolsPage()) {
			count = count + renameObjectInstances(page);
		}
	}

	sketch.UI.message(count + strRenameSuccess);

	if (!debugMode) googleAnalytics(context,"rename","pages");
}

var renamePage = function(context) {
	var count = renameObjectInstances(context.document.currentPage());

	sketch.UI.message(count + strRenameSuccess);

	if (!debugMode) googleAnalytics(context,"rename","page");
}

var renameArtboard = function(context) {
	var predicate = NSPredicate.predicateWithFormat("className == %@","MSArtboardGroup"),
		artboards = context.selection.filteredArrayUsingPredicate(predicate),
		artboardLoop = artboards.objectEnumerator(),
		artboard,
		count = 0;

	if (artboards.count() > 0) {
		while (artboard = artboardLoop.nextObject()) {
			count = count + renameObjectInstances(artboard);
		}

		sketch.UI.message(count + strRenameSuccess);

		if (!debugMode) googleAnalytics(context,"rename","artboard");
	} else {
		sketch.UI.alert(strPluginName,strRenameFailureArtboard);
	}
}

var renameSymbol = function(context) {
	var predicate = NSPredicate.predicateWithFormat("className == %@","MSSymbolMaster"),
		symbols = context.selection.filteredArrayUsingPredicate(predicate),
		symbolLoop = symbols.objectEnumerator(),
		symbol,
		count = 0;

	if (symbols.count() > 0) {
		while (symbol = symbolLoop.nextObject()) {
			var instances = symbol.allInstances(),
				instanceLoop = instances.objectEnumerator(),
				instance;

			while (instance = instanceLoop.nextObject()) {
				if (renameInstance(instance)) count++;
			}
		}

		sketch.UI.message(count + strRenameSuccess);

		if (!debugMode) googleAnalytics(context,"rename","symbol");
	} else {
		sketch.UI.alert(strPluginName,strRenameFailureSymbol);
	}
}

var renameSelected = function(context) {
	var predicate = NSPredicate.predicateWithFormat("className == %@","MSSymbolInstance"),
		instances = context.selection.filteredArrayUsingPredicate(predicate),
		instanceLoop = instances.objectEnumerator(),
		instance,
		count = 0;

	if (instances.count() > 0) {
		while (instance = instanceLoop.nextObject()) {
			if (renameInstance(instance)) count++;
		}

		sketch.UI.message(count + strRenameSuccess);

		if (!debugMode) googleAnalytics(context,"rename","instance");
	} else {
		sketch.UI.alert(strPluginName,strRenameFailure);
	}
}

var renameSelectedOptions = function(context) {
	var predicate = NSPredicate.predicateWithFormat("className == %@","MSSymbolInstance"),
		selections = context.selection.filteredArrayUsingPredicate(predicate),
		selectionLoop = selections.objectEnumerator(),
		selection,
		count = 0;

	if (selections.count() > 0) {
		var alertWindow = COSAlertWindow.new(),
			iconPath = context.plugin.urlForResourceNamed("icon.png").path(),
			icon = NSImage.alloc().initByReferencingFile(iconPath),
			renameSource = createRadios(["Use symbol master name","Use other name…"],0),
			renameTo = createField("",""),
			renameSiblings = createCheckbox({name:"Rename all instances of selected instances",value:1},0),
			renameMaster = createCheckbox({name:"Rename symbol master (local name only)",value:1},1),
			buttonRename = alertWindow.addButtonWithTitle("Rename"),
			buttonCancel = alertWindow.addButtonWithTitle("Cancel");

		renameSource.cells().objectAtIndex(0).setAction("callAction:");
		renameSource.cells().objectAtIndex(0).setCOSJSTargetFunction(function(sender) {
			renameTo.setEnabled(0);
			renameMaster.setEnabled(0);
		});

		renameSource.cells().objectAtIndex(1).setAction("callAction:");
		renameSource.cells().objectAtIndex(1).setCOSJSTargetFunction(function(sender) {
			renameTo.setEnabled(1);
			renameTo.becomeFirstResponder();
			renameMaster.setEnabled(1);
		});

		alertWindow.setIcon(icon);
		alertWindow.setMessageText(strPluginName);
		alertWindow.setInformativeText("Rename selected symbol instances...");
		alertWindow.addAccessoryView(renameSource);
		alertWindow.addAccessoryView(renameTo);
		alertWindow.addAccessoryView(renameMaster);
		alertWindow.addAccessoryView(renameSiblings);

		renameTo.setEnabled(0);
		renameMaster.setEnabled(0);

		setKeyOrder(alertWindow,[
			renameSource,
			renameTo,
			renameMaster,
			renameSiblings,
			buttonRename
		]);

		var alertResponse = alertWindow.runModal();

		if (alertResponse == 1000) {
			if (renameSource.selectedCell().tag() == 1 && renameTo.stringValue() == "") {
				sketch.UI.alert(strPluginName,strRenameFailureString);
			} else {
				var name = (renameTo.stringValue() != "") ? renameTo.stringValue() : false,
					count = 0;

				if (renameSiblings.state() == 1) {
					var masters = NSMutableArray.array();

					while (selection = selectionLoop.nextObject()) {
						var master = selection.symbolMaster();

						if (!masters.containsObject(master)) {
							masters.addObject(master);
						}
					}

					var masterLoop = masters.objectEnumerator(),
						master;

					while (master = masterLoop.nextObject()) {
						var instances = master.allInstances(),
							instanceLoop = instances.objectEnumerator(),
							instance;

						while (instance = instanceLoop.nextObject()) {
							if (renameInstance(instance,name)) count++;
						}

						if (renameSource.selectedCell().tag() == 1 && renameMaster.state() == 1) {
							master.setName(name);
						}
					}
				} else {
					while (selection = selectionLoop.nextObject()) {
						if (renameInstance(selection,name)) count++;

						if (renameSource.selectedCell().tag() == 1 && renameMaster.state() == 1) {
							selection.symbolMaster().setName(name);
						}
					}
				}

				sketch.UI.message(count + strRenameSuccess);

				if (!debugMode) googleAnalytics(context,"rename","instanceOptions");
			}
		} else return false;
	} else {
		sketch.UI.alert(strPluginName,strRenameFailure);
	}
}

var report = function(context) {
	openUrl("https://github.com/sonburn/symbol-instance-renamer/issues/new");

	if (!debugMode) googleAnalytics(context,"report","report");
}

var plugins = function(context) {
	openUrl("https://sonburn.github.io/");

	if (!debugMode) googleAnalytics(context,"plugins","plugins");
}

var donate = function(context) {
	openUrl("https://www.paypal.me/sonburn");

	if (!debugMode) googleAnalytics(context,"donate","donate");
}

function createCheckbox(item,flag,frame) {
	var frame = (frame) ? frame : NSMakeRect(0,0,300,16),
		checkbox = NSButton.alloc().initWithFrame(frame),
		flag = (flag == false) ? NSOffState : NSOnState;

	checkbox.setButtonType(NSSwitchButton);
	checkbox.setBezelStyle(0);
	checkbox.setTitle(item.name);
	checkbox.setTag(item.value);
	checkbox.setState(flag);

	return checkbox;
}

function createField(string,placeholder,frame) {
	var frame = (frame) ? frame : NSMakeRect(0,0,300,24),
		field = NSTextField.alloc().initWithFrame(frame);

	field.setStringValue(string);
	field.setPlaceholderString(placeholder);

	return field;
}

function createRadios(options,selected,format,x,y) {
	var rows = options.length,
		columns = 1,
		matrixWidth = 300,
		cellWidth = matrixWidth,
		x = (x) ? x : 0,
		y = (y) ? y : 0;

	if (format && format != 0) {
		rows = options.length / 2;
		columns = 2;
		matrixWidth = 300;
		cellWidth = matrixWidth / columns;
	}

	var cell = NSButtonCell.alloc().init();

	cell.setButtonType(NSRadioButton);

	var matrix = NSMatrix.alloc().initWithFrame_mode_prototype_numberOfRows_numberOfColumns(
		NSMakeRect(x,y,matrixWidth,rows*20),
		NSRadioModeMatrix,
		cell,
		rows,
		columns
	);

	matrix.setCellSize(NSMakeSize(cellWidth,20));

	for (i = 0; i < options.length; i++) {
		matrix.cells().objectAtIndex(i).setTitle(options[i]);
		matrix.cells().objectAtIndex(i).setTag(i);
	}

	matrix.selectCellAtRow_column(selected,0);

	return matrix;
}

function createSelect(items,selected,frame) {
	var comboBox = NSComboBox.alloc().initWithFrame(frame),
		selected = (selected > -1) ? selected : 0;

	comboBox.addItemsWithObjectValues(items);
	comboBox.selectItemAtIndex(selected);
	comboBox.setNumberOfVisibleItems(16);
	comboBox.setCompletes(1);

	return comboBox;
}

function googleAnalytics(context,category,action,label,value) {
	var trackingID = "UA-118918252-1",
		uuidKey = "google.analytics.uuid",
		uuid = NSUserDefaults.standardUserDefaults().objectForKey(uuidKey);

	if (!uuid) {
		uuid = NSUUID.UUID().UUIDString();
		NSUserDefaults.standardUserDefaults().setObject_forKey(uuid,uuidKey);
	}

	var url = "https://www.google-analytics.com/collect?v=1";
	// Tracking ID
	url += "&tid=" + trackingID;
	// Source
	url += "&ds=sketch" + MSApplicationMetadata.metadata().appVersion;
	// Client ID
	url += "&cid=" + uuid;
	// pageview, screenview, event, transaction, item, social, exception, timing
	url += "&t=event";
	// App Name
	url += "&an=" + encodeURI(context.plugin.name());
	// App ID
	url += "&aid=" + context.plugin.identifier();
	// App Version
	url += "&av=" + context.plugin.version();
	// Event category
	url += "&ec=" + encodeURI(category);
	// Event action
	url += "&ea=" + encodeURI(action);
	// Event label
	if (label) {
		url += "&el=" + encodeURI(label);
	}
	// Event value
	if (value) {
		url += "&ev=" + encodeURI(value);
	}

	var session = NSURLSession.sharedSession(),
		task = session.dataTaskWithURL(NSURL.URLWithString(NSString.stringWithString(url)));

	task.resume();
}

function openUrl(url) {
	NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url));
}

function renameInstance(instance,name) {
	if (instance.symbolMaster()) {
		if (name) {
			instance.setName(name);
			return true;
		} else if (instance.name() != instance.symbolMaster().name().trim()) {
			instance.setName(instance.symbolMaster().name());
			return true;
		} else return false;
	} else {
		log(instance.name() + ' might have a missing symbol master');
	}
}

function renameObjectInstances(object) {
	var predicate = NSPredicate.predicateWithFormat("className == %@","MSSymbolInstance"),
		instances = object.children().filteredArrayUsingPredicate(predicate),
		instanceLoop = instances.objectEnumerator(),
		instance,
		count = 0;

	while (instance = instanceLoop.nextObject()) {
		if (renameInstance(instance)) count++;
	}

	return count;
}

function setKeyOrder(alert,order) {
	for (var i = 0; i < order.length; i++) {
		var thisItem = order[i],
			nextItem = order[i+1];

		if (nextItem) thisItem.setNextKeyView(nextItem);
	}

	alert.alert().window().setInitialFirstResponder(order[0]);
}
