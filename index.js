var fs = require('fs');
var path = require('path');
var SVGO = require('svgo');
var simpleHtmlTokenizer = require('simple-html-tokenizer');

var SELF_CLOSING_PREFIXED_SVG = new RegExp(`<(mat|ion|file)-svg[^>]*?\/>`, 'gi');

module.exports = function (content) {
  var loader = this;
  this.cacheable && this.cacheable();

  return content.replace(SELF_CLOSING_PREFIXED_SVG, function (matchedTag, matchType) {
    var filePath = null;
    var tokenizedSVG = simpleHtmlTokenizer.tokenize(matchedTag);
    var SVGAttributes = tokenizedSVG[0].attributes;

    switch (matchType) {
      case 'mat':
        var category = getAttributeValue(SVGAttributes, 'category');
        var name = getAttributeValue(SVGAttributes, 'name');
        if (!(category && name)) {
          throw new Error('A `mat-svg` tag must contain a `category` and a `name` attribute.');
        }
        filePath = generateMaterialIconPath(category, name);
        break;

      case 'ion':
        var name = getAttributeValue(SVGAttributes, 'name');
        if (!name) {
          throw new Error('A `ion-svg` tag must contain a `name` attribute.');
        }
        filePath = generateIonIconPath(name);
        break;

      case 'file':
        var src = getAttributeValue(SVGAttributes, 'src');
        if (!src) {
          throw new Error('A `file-svg` tag must contain a `src` attribute.');
        }
        filePath = path.join(loader.context, src);
        break;
    }

    try {
      var fileContent = fs.readFileSync(filePath, {encoding: 'utf-8'});
      loader.addDependency(filePath);
      return tidySVG(fileContent, SVGAttributes);
    } catch (e) {
      throw new Error('SVG path ' + filePath + ' does not exist.');
    }
  });
};

// returns the value of the attribute
// if not found provides null
function getAttributeValue(attributesArray, attribute) {
  for (var i = 0; i < attributesArray.length; i++) {
    if (attributesArray[i][0] == attribute) {
      return attributesArray[i][1]
    }
  }
  return null;
}

function generateMaterialIconPath(category, name) {
  // make sure name does not have dashes
  if (name.includes('-') || name.includes(' ')) {
    throw new Error('If the name attribute of a mat-svg is multi-word, it must be separated by underscores.');
  }
  var materialIconName = 'ic_' + name + '_24px.svg';
  return path.resolve(path.join('node_modules', 'material-design-icons', category, 'svg', 'production', materialIconName));
}

function generateIonIconPath(name) {
  // make sure name does not have underscores
  if (name.includes('_') || name.includes(' ')) {
    throw new Error('If the name attribute of a mat-svg is multi-word, it must be separated by hyphens.');
  }
  var ionIconName = name + '.svg';
  return path.resolve(path.join('node_modules', 'ionicons-npm', 'src', ionIconName));
}

function tidySVG(svg, SVGAttributes) {
  // run the SVG contents through an optimizer to clean it up and normalize it
  var svgo = new SVGO({plugins: [{removeTitle: true}]});
  svgo.optimize(svg, function (result) {
    // It's callback, but this is actually run synchronously
    svg = result.data;
  });

  // remove category, name, or src attributes from svg
  SVGAttributes = SVGAttributes.filter(function (attribute) {
    return (attribute[0] != 'category') && (attribute[0] != 'name') && (attribute[0] != 'src');
  });

  var svgHead = svg.slice(0, 4);
  var svgTail = svg.slice(4);
  var SVGAttributesStringified = '';

  SVGAttributes.forEach(function (attr) {
    SVGAttributesStringified = SVGAttributesStringified + ' ' + attr[0] + '="' + attr[1] + '"';
  });

  return (svgHead + ' role="presentation" focusable="false"' + SVGAttributesStringified + svgTail);
}

