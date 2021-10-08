(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.toMeToYou = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const defaultOptions = {
    margin: 20, // text to box margin
    fontSize: 20,
    xOffset: 50, // space between boxes
    boxHeight: 30,
    radius: 5, // box border-radius
    colours: ['#ebdbd4', '#f9f4e1', '#dee6ed', '#f6d6de', '#edecdd', '#d9e5ae'],
    triangleSize: 7,
    leadingEdgeSize: 20, // how far out the new-line edge sticks
};

const getFlow = (container, items, opts = {}) => {
    if (!Array.isArray(items) || !items.length) {
        throw new Error('items needs to be an array of strings or objects');
    }
    items = items.map(item => typeof item === 'string' ? ({ text: item }) : item);

    let {
        margin, fontSize, xOffset, boxHeight,
        radius, colours, triangleSize, leadingEdgeSize
    } = { ...defaultOptions, ...opts };

    const containerDimensions = container.getBoundingClientRect();
    const svg = createSVGContainer(container);
    boxHeight = boxHeight + margin;
    let colourIdx = parseInt(Math.random() * (colours || []).length);

    const entities = items.reduce(
        (acc, { text, bgColour, textColour = 'black' }) => {
            if (Array.isArray(colours) && colours.length && !bgColour) {
                bgColour = colours[colourIdx++];
                if (colourIdx >= colours.length) {
                    colourIdx = 0;
                }
            } else if (!bgColour) {
                bgColour = 'transparent';
            }
            const group = cE('g');
            const rect = cE(
                'rect',
                {
                    height: boxHeight, stroke: 'black', fill: bgColour, 'stroke-width': 1, rx: radius
                }
            );
            const textBox = cE(
                'text',
                {
                    'font-size': fontSize, fill: textColour
                }
            );
            textBox.textContent = text;
            group.appendChild(rect);
            group.appendChild(textBox);
            svg.appendChild(group);
            return [
                ...acc,
                {
                    textBox,
                    rect,
                    text
                }
            ];
        }, []
    );

    const offscreen = getOffscreen();
    offscreen.appendChild(svg);

    const getF = (rect, attr) => parseFloat(rect.getAttribute(attr));
    const getX = rect => getF(rect, 'x') + getF(rect, 'width');

    let dir = 1;
    let y = margin;
    entities.forEach(
        (e, idx, arr) => {
            let x = (idx ? getX(arr[idx-1].rect) + xOffset : margin);
            const textWidth = e.textBox.getBBox().width;
            if (dir === 0) {
                x = (idx ? getF(arr[idx-1].rect, 'x') - (textWidth + margin) - xOffset : 0 - margin);
            }
            const endOfRectX = x + xOffset + textWidth + margin;
            if (endOfRectX > (containerDimensions.width - xOffset) && dir === 1) {
                y = y + boxHeight + margin;
                dir = 0;
                x = containerDimensions.width - (textWidth + margin + xOffset);
            }
            if (x < xOffset && dir === 0) {
                y = y + boxHeight + margin;
                dir = 1;
                x = xOffset;
            }
            e.rect.setAttribute('width', textWidth + margin);
            e.rect.setAttribute('x', x);
            e.rect.setAttribute('y', y);
            e.textBox.setAttribute('x', x + (margin / 2));
            e.textBox.setAttribute('y', y + (boxHeight / 2) + (e.textBox.getBBox().height / 3));
        }
    );
    drawArrows(entities, svg, { triangleSize, leadingEdgeSize });
    container.appendChild(svg);
    offscreen.remove();
}

const cE = (name, attr) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attr || {}).forEach(
        ([k, v]) => el.setAttribute(k, v)
    );
    return el;
}

const drawArrows = (entities, svg, { triangleSize = 7, leadingEdgeSize = 20 } = {}) => {
    const drawStraightLine = (coords) => {
        const line = cE('line', { 'stroke-width': 1 });
        line.setAttribute('style', 'stroke:rgb(0,0,0);stroke-width:1');
        Object.entries(coords).forEach(([k, v]) => line.setAttribute(k, v));
        return line;
    };
    const drawTriangle = (x, y, isRight) => {
        const triangleOffset = isRight ? 0 - triangleSize : triangleSize;
        const poly = cE('polygon', {
            points: [
                [x, y].join(','),
                [x + triangleOffset, y - triangleSize].join(','),
                [x + triangleOffset, y + triangleSize].join(',')
            ].join(' ')
        });
        return poly;
    };
    const drawBridgeLine = ({ x1, y1, x2, y2 }, isRight = true) => {
        const path = cE('path', { 'stroke-width': 1, fill: 'none' });
        path.setAttribute('style', 'stroke:rgb(0,0,0);stroke-width:1');
        const e = isRight ? Math.max(x1, x2) + leadingEdgeSize : Math.min(x1, x2) - leadingEdgeSize;
        path.setAttribute(
            'd',
            [
                `M${x1} ${y1}`,
                `L${e} ${y1}`,
                `L${e} ${y2}`,
                `L${x2} ${y2}`
            ].join(' ')
        );
        return [path, drawTriangle(x2, y2, !isRight)];
    };
    entities.forEach(
        (ent, idx) => {
            if (!idx) {
                return;
            }
            const prev = entities[idx-1];
            let dims = {
                from: prev.rect.getBBox(),
                to: ent.rect.getBBox()
            };
            if (dims.from.y !== dims.to.y) {
                const isRight = idx > 1
                    ? entities[idx-2].rect.getBBox().x < dims.from.x
                    : true;
                const fromX = dims.from.x + (isRight ? dims.from.width : 0);
                const toX = dims.to.x + (isRight ? dims.to.width : 0);
                drawBridgeLine({
                    x1: fromX, y1: dims.from.y + (dims.from.height / 2),
                    x2: toX, y2: dims.to.y + (dims.to.height / 2)
                }, isRight).forEach(item => svg.appendChild(item));
            } else {
                const nextRight = dims.from.x < dims.to.x;
                const fromX = dims.from.x + (nextRight ? dims.from.width : 0);
                const toX = dims.to.x + (nextRight ? 0 : dims.to.width);
                [
                    drawStraightLine({ x1: fromX, y1: dims.from.y + (dims.from.height / 2), x2: toX, y2: dims.to.y + (dims.to.height / 2) }),
                    drawTriangle(toX, dims.to.y + (dims.to.height / 2), nextRight)
                ].forEach(item => svg.appendChild(item));
            }
        }
    );
};

const createSVGContainer = (container) => {
    const containerDimensions = container.getBoundingClientRect();
    const svg = cE(
        'svg',
        {
            width: containerDimensions.width,
            height: containerDimensions.height,
        }
    );
    return svg;
}

const getOffscreen = () => {
    const measurer = document.createElement('div');
    Object.entries({
      position: 'absolute',
      visibility: 'hidden',
      height: 'auto',
      width: 'auto',
      whiteSpace: 'nowrap'
    }).forEach(([k, v]) => measurer.style[k] = v);
    document.body.appendChild(measurer);
    return measurer;
};

module.exports = {
    getFlow
};

},{}]},{},[1])(1)
});
