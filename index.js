const colours = ['#ebdbd4', '#f9f4e1', '#dee6ed', '#f6d6de', '#edecdd', '#d9e5ae'];

const getFlow = (container, items, opts = {}) => {
    let {
        randomColours = false,
        margin = 20,
        fontSize = 20,
        xOffset = 50,
        boxHeight = 30,
        radius = 5
    } = opts;
    const containerDimensions = container.getBoundingClientRect();
    const svg = createSVGContainer(container);
    boxHeight = boxHeight + margin;
    let colourIdx = parseInt(Math.random() * 6);

    if (!Array.isArray(items) || !items.length) {
        throw new Error('items needs to be an array of strings or objects');
    }
    items = items.map(item => typeof item === 'string' ? ({ text: item }) : item);
    const entities = items.reduce(
        (acc, { text, bgColour, textColour = 'black' }, idx) => {
            if (randomColours && !bgColour) {
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
    const getX = rect => parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width'));
    const getF = (rect, attr) => parseFloat(rect.getAttribute(attr));
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
    drawArrows(entities, svg);
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

const drawArrows = (entities, svg) => {
    const tSize = 7;
    const leSize = 20;
    const drawStraightLine = ({ x1, y1, x2, y2 }) => {
        const line = cE('line', { 'stroke-width': 1 });
        line.setAttribute('style', 'stroke:rgb(0,0,0);stroke-width:1');
        line.setAttribute('x1', x1);
        line.setAttribute('x2', x2);
        line.setAttribute('y1', y1);
        line.setAttribute('y2', y2);
        return line;
    };
    const drawTriangle = (x, y, isRight) => {
        const triangleOffset = isRight ? 0 - tSize : tSize;
        const poly = cE('polygon', { 
            points: [
                [x, y].join(','),
                [x + triangleOffset, y - tSize].join(','),
                [x + triangleOffset, y + tSize].join(',')
            ].join(' ')
        });
        return poly;
    };
    const drawBridgeLine = ({ x1, y1, x2, y2 }, isRight = true) => {
        let elements = [];
        if (isRight) {
            const r = Math.max(x1, x2) + leSize;
            return [
                drawStraightLine({
                    x1, y1,
                    x2: r, y2: y1
                }),
                drawStraightLine({
                    x1: r, y1,
                    x2: r, y2
                }),
                drawStraightLine({
                    x1: r, y1: y2,
                    x2, y2 
                }),
                drawTriangle(x2, y2, false)
            ];
        } else {
            const l = Math.min(x1, x2) - leSize;
            return [
                drawStraightLine({
                    x1, y1,
                    x2: l, y2: y1
                }),
                drawStraightLine({
                    x1: l, y1,
                    x2: l, y2
                }),
                drawStraightLine({
                    x1: l, y1: y2,
                    x2, y2 
                }),
                drawTriangle(x2, y2, true)
            ];
        }
        return [];
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
            const isRight = idx > 1
                ? entities[idx-2].rect.getBBox().x < dims.from.x
                : true;
            if (dims.from.y !== dims.to.y) {
                if (isRight) {
                    drawBridgeLine({
                        x1: dims.from.x + dims.from.width, y1: dims.from.y + (dims.from.height / 2),
                        x2: dims.to.x + dims.to.width, y2: dims.to.y + (dims.to.height / 2)
                    }).forEach(item => svg.appendChild(item));
                } else {
                    drawBridgeLine({
                        x1: dims.from.x, y1: dims.from.y + (dims.from.height / 2),
                        x2: dims.to.x, y2: dims.to.y + (dims.to.height / 2)
                    }, false).forEach(item => svg.appendChild(item));
                }
            } else if (dims.from.x > dims.to.x) {
                [
                    drawStraightLine({ x1: dims.from.x, y1: dims.from.y + (dims.from.height / 2), x2: dims.to.x + dims.to.width, y2: dims.to.y + (dims.to.height / 2) }),
                    drawTriangle(dims.to.x + dims.to.width, dims.to.y + (dims.to.height / 2), false)
                ].forEach(item => svg.appendChild(item));
            } else {
                [
                    drawStraightLine({ x1: dims.from.x + dims.from.width, y1: dims.from.y + (dims.from.height / 2), x2: dims.to.x, y2: dims.to.y + (dims.to.height / 2) }),
                    drawTriangle(dims.to.x, dims.to.y + (dims.to.height / 2), true)
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
