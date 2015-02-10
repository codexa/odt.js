# odt.js
odt.js is a Javascript library to convert odt to html and back.

## Limitations

**Currently, `setHTML` only supports html as returned by `getHTML`,
maybe with minor modifications such as changing text.** Currently, this
means `setHTML` will throw when given arbitrary html.

Currently, odt.js depends on the browser's XML parser, DOM parser
and DOM serializer. If you want to use odt.js on the server, one
way forward is to modify it to add support for pure javascript parsers.
Keep in mind that for strictness parity with the in-browser parser, you
need a DOM parser which breaks up the `<p>` in `<p><div></div></p>`.

Unsupported odt features:

- Features on which `getHTML` throws
	- Any encoding other than utf-8
	- Annotations
	- Tracked changes
	- Charts
- Features on which `getHTML` doesn't throw
	- Various types of images
	- Non-"manual" styles
	- Unordered lists
	- List styles (bullets,)
	- Strikethrough
	- Underlined text nested inside non-underlined text
	- Underline-color
	- Loads of other styles

And much more.

## Strictness

**Warning: currently, the following goes only within a single version of
odt.js. So you can't `getHTML`, store the html, `setHTML` with
another version of odt.js and expect a correct odt.**

`getHTML` throws when otherwise a `getHTML` -> set html -> get html ->
`setHTML` roundtrip would not produce the original odt file (barring xml
encoding and zip file changes). This is the case for most unsupported
odt features, except unsupported text styles.

`getHTMLUnsafe` probably won't produce html that's totally useless,
since browsers are very forgiving. It might produce html which does not
accurately represent the odt, though `getHTML` will also do that for
unsupported styles.

`setHTML` throws when otherwise a `setHTML` -> `getHTML` roundtrip would
not produce the original html (barring style and html encoding changes).
This is the case for most unsupported html features, except unsupported
text styles. The hope is that it means the resulting odt is not broken,
but it's no guarantee.

`setHTMLUnsafe` might produce completely broken odt files.

## Usage

	<script src="jszip.js"></script>
	<script src="lib/odt.js"></script>

### odt2html

	var html;
	try {
		html = new ODTDocument(odt).getHTML();
	} catch(e) {
		alert("Couldn't parse odt file.");
		throw e;
	}

If you definitely want html while caring less about whether or not it is
correct:

	var html = new ODTDocument(odt).getHTMLUnsafe();

If you want fallback html:

	var odtdoc = new ODTDocument(odt);
	var html = odtdoc.getHTMLUnsafe();
	try {
		html = odtdoc.getHTML();
	} catch(e) {
		console.error('html is probably broken');
	}

### html2odt

**As mentioned in [Limitations][], this example is currently
non-functional for arbitrary html.**

	var req = new XMLHttpRequest();
	req.open('GET', 'res/empty.odt');
	req.responseType = 'arraybuffer';
	req.addEventListener('load', function() {
		var empty = req.response;
		
		var odtdoc = new ODTDocument(empty);
		try {
			odtdoc.setHTML(html);
		} catch(e) {
			alert("Couldn't generate odt document.");
			throw e;
		}
		var odt = odtdoc.getODT();
	});
	req.send();

If you definitely want odt while caring less about whether or not it is
a valid odt file:

		var odtdoc = new ODTDocument(empty);
		odtdoc.setHTMLUnsafe(html);
		var odt = odtdoc.getODT();

If you want a fallback odt:

		var odtdoc = new ODTDocument(empty);
		try {
			odtdoc.setHTML(html);
		} catch(e) {
			odtdoc.setHTMLUnsafe(html);
			console.error('odt is probably broken');
		}
		var odt = odtdoc.getODT();

### Simple odt editor:

	var iframe = document.createElement('iframe');
	var odtdoc = new ODTDocument(odt);
	var html = odtdoc.getHTMLUnsafe();
	try {
		html = odtdoc.getHTML();
	} finally {
		iframe.contentDocument.write(html);
		iframe.contentDocument.close();
	}
	iframe.contentDocument.documentElement.addEventListener('input', function save() {
		try {
			odtdoc.setHTML(iframe.contentDocument.documentElement.outerHTML);
		} catch(e) {
			alert("Generating ODT file failed.");
			throw e;
		}
		odt = odtdoc.getODT();
	});

## Documentation

### `ODTDocument`

`new ODTDocument(String|ArrayBuffer|Uint8Array|Buffer odt[, Object options]) -> ODTDocument | Error`

Initialize an ODTDocument.

For arguments and errors, see the [JSZip documentation][JSZipLoad].

### `ODTDocument#getHTML`

`ODTDocument#getHTML() -> html | TypeError | Error`

Convert the odt document to html.

Throws `TypeError` if [JSZip][] or [DOMParser][] is undefined or if
DOMParser does not support parsing text/xml and text/html.

Throws `Error` if the odt uses unsupported features (it doesn't throw on
unsupported text styles, though). For more details, see [Strictness][]
above.

### `ODTDocument#getHTMLUnsafe`

`ODTDocument#getHTMLUnsafe() -> html | TypeError`

Throws `TypeError` if [JSZip][] or [DOMParser][] is undefined or if
DOMParser does not support parsing text/xml and text/html.

### `ODTDocument#setHTML`

`ODTDocument#setHTML(String html) -> undefined | TypeError | Error`

Throws `TypeError` if [DOMParser][] is undefined or if DOMParser does
not support parsing text/xml.

Throws `Error` if the html uses unsupported features. For more details,
see [Strictness][] above.

### `ODTDocument#setHTMLUnsafe`

`ODTDocument#setHTMLUnsafe(String html) -> undefined | TypeError`

Throws `TypeError` if [DOMParser][] is undefined or if DOMParser does
not support parsing text/xml.

### `ODTDocument#getODT`

`ODTDocument#getODT([Object options]) -> String|ArrayBuffer|Uint8Array|Buffer | Error`

Generate an odt file from the ODTDocument.

For `options` and errors, see the [JSZip documentation][JSZipGenerate].

## Contributing

### Tips

odt.js is very strict towards its own code (except the `Unsafe`
functions, that is). `getHTML` throws when a odt 2 html 2 odt roundtrip
doesn't produce exactly the same odt file, and also when it produced
invalid html (it's not as strict about the latter, though, e.g. it
throws when you produce one `<p>` inside another).

One way to go about adding features to odt.js is to use
`getHTMLUnsafe` and iterate until that generates something sane.

Another way is to use `getHTML` and set a breakpoint on the line that
`throw`s, diff (using a word-granular diff tool) the two things that
were different, and work backwards from there.

It also helps to decide in advance on a strategy for producing html from
which the original odt can be derived losslessly.

### Guidelines

Keep in mind that the html produced should be useful on both screen and
print media.

Please follow the code style of surrounding code, so single quotes
unless the string contains a single quote, `if(` instead of `if (`, etc.

If you want to modify odt.js for use outside the browser, see tips
in [Limitations][].


[JSZip]: https://stuk.github.io/jszip/
[DOMParser]: https://developer.mozilla.org/docs/Web/API/DOMParser
[JSZipLoad]: https://stuk.github.io/jszip/documentation/api_jszip/load.html
[JSZipGenerate]: https://stuk.github.io/jszip/documentation/api_jszip/generate.html
[Strictness]: #strictness
[Limitations]: #limitations