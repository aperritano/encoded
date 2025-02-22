from snovault import (
    AuditFailure,
    audit_checker,
)
from .conditions import rfa
from .formatter import (
    audit_link,
    path_to_text,
)


@audit_checker('AntibodyLot', frame='object')
def audit_antibody_dbxrefs_ar(value, system):
    dbxrefs = value.get('dbxrefs')
    if dbxrefs:
        for entry in dbxrefs:
            if entry.startswith('AR:'):
                return
    detail = ('Antibody {} does not have AR dbxrefs.'.format(
        audit_link(path_to_text(value['@id']), value['@id'])
        )
    )
    yield AuditFailure('missing antibody registry reference', detail,
                       level='INTERNAL_ACTION')


@audit_checker('AntibodyLot', frame=[
    'award',
    'targets',
    'characterizations',
    'characterizations.target'],
    condition=rfa('ENCODE3', 'modERN', 'ENCODE4'))
def audit_antibody_missing_characterizations(value, system):
    '''
    Check to see what characterizations are lacking for each antibody,
    for the cell lines we know about.
    '''
    if value.get('control_type'):
        return

    # ENCD-4608 ENCODE4 tag antibodies need only linked biosample
    # characterization(s) as primary characterization(s) and don't need any
    # secondary characterizations
    if all([
        value.get('award', {}).get('rfa') == 'ENCODE4',
        {'tag', 'synthetic tag'} & {
            i for t in value.get('targets', {})
            for i in t.get('investigated_as', [])
        }
    ]):
        if not value['used_by_biosample_characterizations']:
            detail = ('{} is an ENCODE4 antibody and hasn\'t been linked to '
                'any biosample characterizations.'.format(
                    audit_link(path_to_text(value['@id']), value['@id'])
                )
            )
            yield AuditFailure(
                'no biosample characterizations linked',
                detail,
                level='NOT_COMPLIANT'
            )
            return
        if (
            {
                'characterized to standards',
                'characterized to standards with exemption'
            } & {r['status'] for r in value['lot_reviews']}
        ):
            return
        detail = ('{} is an ENCODE4 antibody and hasn\'t been linked to '
            'any compliant biosample characterizations.'.format(
                audit_link(path_to_text(value['@id']), value['@id'])
            )
        )
        yield AuditFailure(
            'need one compliant biosample characterization',
            detail,
            level='NOT_COMPLIANT'
        )
        return

    if not value['characterizations']:
        detail = ('Antibody {} does not have'
            ' any supporting characterizations submitted.'.format(
                audit_link(path_to_text(value['@id']), value['@id'])
            )
        )
        yield AuditFailure('no characterizations submitted', detail, level='NOT_COMPLIANT')
        return

    primary_chars = []
    secondary_chars = []
    compliant_secondary = False

    for char in value['characterizations']:
        if 'primary_characterization_method' in char:
            primary_chars.append(char)
        if 'secondary_characterization_method' in char:
            secondary_chars.append(char)
            if char['status'] in ['compliant', 'exempt from standards']:
                compliant_secondary = True

    if not primary_chars:
        detail = ('Antibody {} does not have'
            ' any primary characterizations submitted.'.format(
                audit_link(path_to_text(value['@id']), value['@id'])
            )
        )
        yield AuditFailure('no primary characterizations', detail, level='NOT_COMPLIANT')

    if not secondary_chars:
        detail = ('Antibody {} does not have'
            ' any secondary characterizations submitted.'.format(
                audit_link(path_to_text(value['@id']), value['@id'])
            )
        )
        yield AuditFailure('no secondary characterizations', detail, level='NOT_COMPLIANT')

    for lot_review in value['lot_reviews']:
        if lot_review['detail'] in \
            ['Awaiting a compliant primary and pending review of a secondary characterization.',
             'Awaiting a compliant primary and secondary characterization was not reviewed.',
             'Awaiting a compliant primary and submission of a secondary characterization.',
             'Awaiting a compliant primary characterization.',
             'Awaiting compliant primary and secondary characterizations.',
             'Primary characterization not reviewed and awaiting a compliant secondary characterization.',
             'Primary characterization not reviewed and pending review of a secondary characterization.',
             'Primary characterization not reviewed.',
             'Pending review of primary and secondary characterizations.',
             'Pending review of primary characterization and awaiting a compliant secondary characterization.',
             'Pending review of primary characterization and secondary characterization not reviewed.',
             'Pending review of primary characterization.']:
            biosample = lot_review['biosample_term_name']
            if biosample == 'any cell type or tissue':
                biosample = 'one or more cell types/tissues.'

            detail = ('Antibody {} needs a compliant primary in biosample {}.'.format(
                audit_link(path_to_text(value['@id']), value['@id']),
                biosample
                )
            )
            yield AuditFailure('need compliant primaries', detail, level='NOT_COMPLIANT')

    if secondary_chars and not compliant_secondary:
        detail = ('Antibody {} needs a compliant secondary characterization.'.format(
            audit_link(path_to_text(value['@id']), value['@id'])
            )
        )
        yield AuditFailure('need compliant secondary', detail, level='NOT_COMPLIANT')
        return
