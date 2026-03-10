/*jshint node:true*/


function createAlias(doclet, alias) {
	var clone = {};

	Object.keys(doclet).forEach((key) => {
		clone[key] = doclet[key];
	});

	if (alias.indexOf('#') !== -1) {
		clone.longname = alias;
		clone.memberof = alias.split('#')[0];
		clone.name = alias.split('#')[1];
	} else {
		clone.longname = clone.memberof + '#' + alias;
		clone.name = alias;
	}

	delete clone.returns;
	delete clone.examples;
	delete clone.meta;
	delete clone.aliases;

	clone.isAlias = true;
	clone.description = 'Alias for <a href="#' + doclet.name + '">' + doclet.longname + '</a>';

	return clone;
}

exports.handlers = {
	parseComplete: (e) => {
		var doclets = e.doclets.slice();

		doclets.forEach((doclet) => {
			// Duplicate doclets with aliases
			if (doclet.aliases) {
				doclet.aliases.forEach((alias) => {
					e.doclets.push(createAlias(doclet, alias));
				});
			}
		});
	}
};

exports.defineTags = (dict) => {
	dict.defineTag('aliases', {
		onTagged: (doclet, tag) => {
			doclet.aliases = tag.text.split(',');
		}
	});

	dict.defineTag('category', {
		onTagged: (doclet, tag) => {
			doclet.category = tag.text;
		}
	});
};