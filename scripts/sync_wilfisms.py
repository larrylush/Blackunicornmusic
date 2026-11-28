"""Read the public Wilfisms sales page for the merchandise catalogue."""
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

SALES_PAGE = 'https://www.wilfisms.com/buy-art'
MEDIA = 'https://static.wixstatic.com/media/'
VOID_TAGS = set('area base br col embed hr img input link meta param source track wbr'.split())
PRICE = re.compile(r'£\s*[\d,]+(?:\.\d{2})?')
SOLD = re.compile(r'(?:\bsold(?:\s+out)?\b(?=[\s.!*\])–—-]*$)|[\[(]\s*sold(?:\s+out)?\s*[\])])', re.I)
DETAILS = re.compile(r'\s+(?=(?:oil|acrylic|mixed media|watercolou?r|ink|gouache|print)\b)', re.I)


class SalesPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.components = []
        self.sales_section = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        section, component = self.stack[-1][1:] if self.stack else (None, None)
        if tag == 'section' and any(frame[0] == 'main' for frame in self.stack):
            section = attrs.get('id')
            if section == 'comp-m2jdjww7':
                self.sales_section = True
        classes = attrs.get('class', '').split()
        if section and attrs.get('id') and {'wixui-image', 'wixui-rich-text'}.intersection(classes):
            component = {'id': attrs['id'], 'section': section, 'text': [], 'image': None}
            self.components.append(component)
        if component and tag in ('p', 'br'):
            component['text'].append('\n')
        if component and tag == 'img' and attrs.get('src', '').startswith(MEDIA):
            component['image'] = attrs['src'].split('/v1/', 1)[0]
        if tag not in VOID_TAGS:
            self.stack.append((tag, section, component))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self.stack and self.stack[-1][2]:
            self.stack[-1][2]['text'].append(data)


def image_source(record):
    return record.get('img', '').split('/v1/', 1)[0]


def parse_sales_page(source, previous):
    page = SalesPage()
    page.feed(source)
    page.close()
    if not page.sales_section or not re.search(r'</html\s*>', source, re.I):
        raise ValueError('Incomplete Wilfisms sales page')

    records = {}
    previous = {urlsplit(row['url']).fragment: row for row in previous}
    sections = {component['section'] for component in page.components}
    for section in sorted(sections):
        components = [component for component in page.components if component['section'] == section]
        images = {index: component['image'] for index, component in enumerate(components) if component['image']}
        captions = {}
        for index, component in enumerate(components):
            text = ' '.join(''.join(component['text']).split())
            if PRICE.search(text) or SOLD.search(text):
                captions[index] = text
        if not captions and section != 'comp-m2jdjww7':
            continue
        if len(captions) != len(images):
            raise ValueError('Wilfisms artwork and caption counts differ')

        # Existing image URLs keep the right painting attached even when Wix
        # renders captions and images in a different order.
        assigned = {}
        for index in captions:
            old = previous.get(components[index]['id'], {})
            matches = [position for position, image in images.items() if image == image_source(old)]
            if len(matches) == 1:
                position = matches[0]
                assigned[index] = images.pop(position)

        start = 0
        for index, text in captions.items():
            component_id = components[index]['id']
            old = previous.get(component_id, {})
            if index not in assigned:
                candidates = [position for position in images if start <= position < index]
                if len(candidates) != 1:
                    raise ValueError(f'Cannot match Wilfisms artwork to caption {component_id}')
                assigned[index] = images.pop(candidates[0])
            start = index + 1
            image = assigned[index]
            sold = bool(SOLD.search(PRICE.sub('', text)))
            price_match = PRICE.search(text)
            caption = SOLD.sub('', PRICE.sub('', text)).strip(' -–—()[]')
            title, *details = re.split(r'\s+[-–—]\s+|' + DETAILS.pattern, caption, maxsplit=1, flags=re.I)
            title = title.strip(' -–—()[]')
            if not title and not old:
                raise ValueError(f'Missing Wilfisms title for {component_id}')
            if not title or title.casefold() == old.get('title', '').casefold():
                title = old['title']
            elif title.isupper():
                title = title.title()

            description = 'Original artwork by Wilf Frost.'
            if details:
                detail = details[0].strip(' -–—()[]')
                detail = re.sub(r'(?<=\d)\s*[x×]\s*(?=\d)', ' × ', detail)
                detail = re.sub(r'(?<=\d)\s*cm\b', ' cm', detail)
                detail = re.sub(r'\s+[-–—]\s+|\s+(?=\d+\s*×)', ', ', detail)
                if detail:
                    description += ' ' + detail[0].upper() + detail[1:] + '.'
            elif old:
                description = old['description']
            url = f'{SALES_PAGE}#{component_id}'
            record = {
                'title': title,
                'category': 'Art',
                'img': old['img'] if image_source(old) == image else
                       f'{image}/v1/fit/w_760,h_760,q_85/{image.rsplit("/", 1)[-1]}',
                'url': url,
                'description': description,
                'price': price_match.group().replace(' ', '') if price_match else None,
                'seller': 'Wilfisms',
            }
            if sold:
                record['sold'] = True
            records[url] = record
    return records


def scan_wilfisms(previous):
    request = Request(SALES_PAGE, headers={'User-Agent': 'BlackUnicornCatalogue/1.0 (label catalogue sync)'})
    with urlopen(request, timeout=12) as response:
        if response.url.rstrip('/') != SALES_PAGE:
            raise ValueError('Unexpected Wilfisms redirect')
        source = response.read(4_000_001)
    if len(source) > 4_000_000:
        raise ValueError('Wilfisms sales page exceeds size limit')
    return parse_sales_page(source.decode('utf-8'), previous)
