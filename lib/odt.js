/* This file is licensed under the General Public License. */

var ODTDocument = function(odt, options) {
	var zip = new JSZip(odt, options);
	var find = function(object, value) {
		var key;
		Object.keys(object).some(function(_key) {
			if(object[_key] === value) {
				key = _key;
				return true;
			}
		});
		return key;
	};
	var attribute = function(name, value) {
		return name + '="' + value.replace(/"/g, '&quot;') + '"';
	};
	var styles = {
		'fo:text-align': 'text-align',
		'style:font-name': 'font-family',
		'fo:font-size': 'font-size',
		'fo:font-weight': 'font-weight',
		'fo:font-style': 'font-style',
		'fo:color': 'color',
	};
	var styleToHTML = function(name, value) {
		if(name === 'style:text-underline-style' && value === 'solid') {
			return 'text-decoration: underline; ' + styleToHTML(name.replace(':', '--'), value);
		} else if(name === 'style:text-position') {
			return 'vertical-align: ' + value.split(' ')[0] + ';' +
				'font-size: ' + value.split(' ')[1] + '; ' +
				styleToHTML(name.replace(':', '--'), value);
		}
		return (styles[name] || name.replace(':', '--')) + ': ' + value + ';';
	};
	var styleToODT = function(name, value) {
		name = find(styles, name);
		return name ? attribute(name, value) : ''; 
	};
	var attributes = {
		'text:style-name': 'class',
		'table:style-name': 'class',
		'xlink:href': 'href',
		
		'xml:id': 'id',
	};
	var attributeToHTML = function(name, value) {
		return attribute(attributes[name] || name, value);
	};
	var attributeToODT = function(name, value) {
		return attribute(find(attributes, name) || name, value);
	};
	var elements = {
		/**
		 * Meaning of the "operators" here:
		 * odtName: htmlName
		 * a: b means that any <a> is replaced with <b>
		 * a>>b: c means that any <a><b/></a> is replaced with <c/>
		 * a: b/c means that any <a> is replaced with <b data-type="c">
		 */
		
		'office:document-content': 'html',
		'office:body>>office:text': 'body',
		
		'office:scripts': 'script',
		
		'text:p': 'p',
		'text:span': 'span',
		'text:a': 'a',
		'text:list': 'ol',
		'text:list-item': 'li',
		'text:line-break': 'br',
		
		'table:table': 'table',
		'table:table-row': 'tr',
		'table:table-column': 'col',
		'table:table-cell': 'td',
		
		'draw:frame>>draw:image': 'img',
		'draw:object': 'object',
		
		'office:automatic-styles': 'style',
		'office:font-face-decls': 'style/fonts',
	};
	var voidElements = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
	var keys = function(map) {
		var keys = [];
		map.forEach(function(value, key) {
			keys.push(key);
		});
		return keys;
	};
	var nodeToHTML = function(node, contents) {
		if(node.nodeType === 3) {
			return (
				node.nodeValue
				.replace(/</g, '&lt;').replace(/>/g, '&gt;')
				.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '')
				.replace(/\u00A0/g, '&nbsp;')
			);
		}
		
		var simpleElementToHTML = function(contents) {
			var htmlNameString = (elements[name] || name).replace(/\/(.*)/, ' data-type="$1"');
			var htmlName = htmlNameString.split(' ')[0];
			return '<' + htmlNameString + keys(attrs).map(function(name) {
				return ' ' + attributeToHTML(name, attrs.get(name));
			}).join('') + '>' + (voidElements.indexOf(htmlName) === -1 ? contents() + '</' + htmlName + '>' : '');
		};
		var commentedElementToHTML = function(contents) {
			return '/*<' + name + keys(attrs).map(function(name) {
				return ' ' + attribute(name, attrs.get(name));
			}).join('') + '>*/\n' + contents() + '\n/*</' + name + '>*/';
		};
		
		var name = node.nodeName;
		var attrs = new Map();
		for(var i = 0; i < node.attributes.length; i++) {
			attrs.set(node.attributes[i].name, node.attributes[i].value);
		}
		if(node.childNodes.length === 1 && elements[name + '>>' + node.childNodes[0].nodeName]) {
			name += '>>' + node.childNodes[0].nodeName;
			attrs.set('_child_attrs', [].map.call(node.childNodes[0].attributes, function(attr) {
				return attribute(attr.name, attr.value);
			}).join(' '));
			return simpleElementToHTML(function() {
				return contents().match(/^<[^>]*>([\s\S]*)<\/[^>]*>$/)[1];
			});
		}
		switch(name) {
			case 'text:tab':
				return '<span style="white-space:pre">\t</span>';
			case 'text:note-body':
				contents = (function(contents) {
					return function() {
						return contents().replace(/<(\/?)p\b/g, '<$1text:p');
					};
				})(contents);
				break;
			case 'office:annotation':
				contents = (function(contents) {
					return function() {
						return contents().replace(/<(\/?)p\b/g, '<$1text:p').replace(/<(\/?)ol\b/g, '<$1text:list').replace(/<(\/?)li\b/g, '<$1text:list-item');
					};
				})(contents);
				break;
			case 'style:style':
			case 'text:list-style':
				return commentedElementToHTML(function() {
					return [
						'[class="' + attrs.get('style:name') + '"] {',
						contents(),
						'}',
					].join('\n');
				});
			case 'style:paragraph-properties':
			case 'style:text-properties':
			case 'style:table-properties':
			case 'style:table-column-properties':
			case 'style:table-cell-properties':
			case 'style:graphic-properties':
				return commentedElementToHTML(function() {
					return keys(attrs).map(function(name) {
						return styleToHTML(name, attrs.get(name)) + '\n';
					}).join('') +
					contents();
				});
			case 'draw:image':
				attrs.set('src', 'data:image/png;base64,' + btoa(zip.file(attrs.get('xlink:href').replace(/^\.\//, '')).asBinary()));
				break;
			case 'draw:object':
				attrs.set('data', 'bla');
				break;
		}
		if(name.substr(0, 6) === 'style:' || name.substr(0, 14) === 'svg:font-face-' || name.substr(0, 22) === 'text:list-level-style-') {
			// Unsupported style element
			return commentedElementToHTML(contents);
		}
		return simpleElementToHTML(contents);
	};
	var nodeToODT = function(node, contents) {
		if(node.nodeType === 3) {
			return node.nodeValue.replace(/&nbsp;/g, '\u00A0');
		}
		
		var simpleElementToODT = function(odtName, attrs, contents) {
			return '<' + odtName + keys(attrs).map(function(name) {
				if(name === 'data-type') return '';
				return ' ' + attributeToODT(name, attrs.get(name));
			}).join('') + '>' + contents() + '</' + odtName + '>';
		};
		
		var name = node.nodeName.toLowerCase();
		var attrs = new Map();
		for(var i = 0; i < node.attributes.length; i++) {
			attrs.set(node.attributes[i].name, node.attributes[i].value);
		}
		switch(name) {
			case 'html':
				var defaultattrs = {
					'xmlns:office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
					'xmlns:style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
					'xmlns:text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
					'xmlns:table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
					'xmlns:draw': 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
					'xmlns:xlink': 'http://www.w3.org/1999/xlink',
					'office:version': '1.2',
				};
				Object.keys(defaultattrs).forEach(function(name) {
					attrs.set(name, attrs.get(name) || defaultattrs[name]);
				});
				break;
			case 'style':
				if(attrs.get('_odt2html2odt_styles') !== undefined) {
					return '';
				} else {
					contents = (function(contents) {
						return function() {
							return (contents().match(/\/\*.*?\*\//g) || []).map(function(tag) {
								return tag.match(/\/\*(.*?)\*\//)[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>');
							}).join('');
						};
					})(contents);
				}
				break;
			case 'span':
				if(attrs.get('style') === 'white-space:pre' && contents() === '\t') {
					return '<text:tab></text:tab>';
				}
				break;
			case 'img':
				attrs.delete('src');
				break;
			case 'draw:object':
				attrs.delete('data');
				break;
		}
		var odtName = find(elements, name + '/' + attrs.get('data-type')) || find(elements, name) || (name.indexOf(':') !== -1 && name);
		if(!odtName) {
			return contents();
		}
		if(odtName.indexOf('>>') !== -1) {
			var childAttrs = new Map(attrs.get('_child_attrs') && attrs.get('_child_attrs').split(' ').map(function(attr) {
				return [attr.split('=')[0], attr.split('=')[1].match(/^(["']?)(.*)?\1$/)[2]];
			}));
			attrs.delete('_child_attrs');
			return simpleElementToODT(odtName.split('>>')[0], attrs, function() {
				return simpleElementToODT(odtName.split('>>')[1], childAttrs, contents);
			});
		}
		return simpleElementToODT(odtName, attrs, contents);
	};
	var traverse = function(node, callback) {
		return callback(node, function() {
			return [].map.call(node.childNodes, function(node) {
				if(node.nodeType === 1) {
					return traverse(node, callback);
				}
				return callback(node);
			}).join('');
		});
	};
	var documentToHTML = function(zip) {
		return (
			'<!DOCTYPE html>' +
			traverse(new DOMParser().parseFromString(zip.file('content.xml').asText(), 'text/xml').documentElement, nodeToHTML).replace(/<html[^>]*>/, [
				'$&<head><style _odt2html2odt_styles="">',
				'p {',
				'	margin: 0;',
				'	min-height: 1em;',
				'}',
				'office\\:annotation {',
				'	display: none;',
				'}',
				'text\\:note-citation, text\\:note-body {',
				'	vertical-align: super;',
				'	font-size: .83em;',
				'}',
				'text\\:note-body:before {',
				'	content: "\\A0(";',
				'}',
				'text\\:note-body:after {',
				'	content: ")";',
				'}',
				'text\\:tracked-changes {',
				'	display: none;',
				'}',
				'</style>',
			].join('\n')).replace('<body', '</head>$&')
		);
	};
	var documentToODT = function(html) {
		return (
			'<?xml version="1.0" encoding="UTF-8"?>\n' +
			traverse(new DOMParser().parseFromString(html, 'text/html').documentElement, nodeToODT)
			.replace(/'/g, '&apos;')
		);
	};
	var normalize = function(html) {
		return (
			html
			.replace(/<([\w:-]+)([^>]*)><\/\1>/g, '<$1$2/>') // Normalize empty elements
			.replace(/<(\/?)([\w:-]+)\s*([^>]*?)(\/?)>/g, function(tag, close, name, attrString, selfClosing) {
				return '<' + close + name + ' ' + attrString.split(/\s+/).sort().join(' ') + selfClosing + '>'; // Normalize tag spacing and attribute order
			})
		);
	};
	var getDocHTML = function(doc) {
		var doctype = doc.doctype;
		var doctypeString = doctype ? '<!DOCTYPE '
			+ doctype.name
			+ (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
			+ (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '')
			+ (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
			+ '>' : '';
		return doctypeString + doc.documentElement.outerHTML;
	};
	this.getHTMLUnsafe = function() {
		return documentToHTML(zip);
	};
	this.setHTMLUnsafe = function(html) {
		zip.file('content.xml', documentToODT(html));
	};
	this.getHTML = function() {
		var html = this.getHTMLUnsafe();
		
		// Roundtrip check
		var tidiedHtml = getDocHTML(new DOMParser().parseFromString(html, 'text/html'));
		if(normalize(tidiedHtml) !== normalize(html)) {
			throw new Error("Couldn't parse ODT file: produced invalid HTML.");
		}
		var original = {}, roundTripped = {};
		Object.keys(zip.files).forEach(function(key) {
			original[key] = zip.files[key].asBinary();
			if(key === 'content.xml') {
				original[key] = normalize(original[key]);
			}
		});
		this.setHTMLUnsafe(tidiedHtml);
		Object.keys(zip.files).forEach(function(key) {
			roundTripped[key] = zip.files[key].asBinary();
			if(key === 'content.xml') {
				roundTripped[key] = normalize(roundTripped[key]);
			}
		});
		if(JSON.stringify(roundTripped) !== JSON.stringify(original) || normalize(this.getHTMLUnsafe()) !== normalize(html)) {
			throw new Error("Couldn't parse ODT file: roundtrip failed.");
		}
		
		return html;
	};
	this.setHTML = function(html) {
		this.setHTMLUnsafe(html);
		
		// Roundtrip check
		if(normalize(this.getHTML()) !== normalize(html)) {
			throw new Error("Couldn't generate ODT file: roundtrip failed.");
		}
	};
	this.getODT = function(options) {
		return zip.generate(options);
	};
}