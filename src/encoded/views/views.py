from ..resource import resource
from . import CollectionViews


@resource(pattern='')
class Home(object):
    def __init__(self, request):
        self.request = request

    def get(self):
        request = self.request
        result = {
            'title': 'Home',
            'portal_title': 'ENCODE 3',
            '_links': {
                'self': {'href': request.route_path(self.__route__)},  # See http://git.io/_OKINA
                'profile': {'href': '/profiles/portal'},
                # 'login': {'href': request.route_path('login')},
                },
            }
        return result


#    permission='admin'  ## this prevents loading of users via post_json
@resource(pattern='/users/{path_segment}', collection_pattern='/users/')
class User(CollectionViews):
    properties = {
        'title': 'DCC Users',
        'description': 'Listing of current ENCODE DCC users',
        }


@resource(pattern='/labs/{path_segment}', collection_pattern='/labs/')
class Lab(CollectionViews):
    properties = {
        'title': 'Labs',
        'description': 'Listing of ENCODE DCC labs',
        }


@resource(pattern='/awards/{path_segment}', collection_pattern='/awards/')
class Award(CollectionViews):
    properties = {
        'title': 'Awards (Grants)',
        'description': 'Listing of awards (aka grants)',
        }


@resource(name='antibody_lot', pattern='/antibody-lots/{path_segment}', collection_pattern='/antibody-lots/')
class AntibodyLots(CollectionViews):
    properties = {
        'title': 'Antibodies Registry',
        'description': 'Listing of ENCODE antibodies',
        }
    links = {
        'source': {'href': '/sources/{source_uuid}', 'templated': True},
        }
    embedded = set(['source'])


@resource(pattern='/organisms/{path_segment}', collection_pattern='/organisms/')
class Organism(CollectionViews):
    properties = {
        'title': 'Organisms',
        'description': 'Listing of all registered organisms',
        }


@resource(pattern='/sources/{path_segment}', collection_pattern='/sources/')
class Source(CollectionViews):
    properties = {
        'title': 'Sources',
        'description': 'Listing of sources and vendors for ENCODE material',
        }


@resource(pattern='/biosamples/{path_segment}', collection_pattern='/biosamples/')
class Biosample(CollectionViews):
    properties = {
        'title': 'Biosamples',
        'description': 'Listing of ENCODE3 biosamples',
        }


@resource(pattern='/targets/{path_segment}', collection_pattern='/targets/')
class Target(CollectionViews):
    item_type = 'target'
    properties = {
        'title': 'Targets',
        'description': 'Listing of ENCODE3 targets',
        }
    links = {
        'organism': {'href': '/organisms/{organism_uuid}', 'templated': True, 'embedded': True},
        }
    embedded = set(['organism'])


# The following should really be child collections.
@resource(pattern='/validations/{path_segment}', collection_pattern='/validations/')
class Validation(CollectionViews):
    properties = {
        'title': 'Antibody Validations',
        'description': 'Listing of antibody validation documents',
        }
    links = {
        'antibody_lot': {'href': '/antibody-lots/{antibody_lot_uuid}', 'templated': True, 'embedded': True},
        'target': {'href': '/targets/{target_uuid}', 'templated': True, 'embedded': True},
        }
    embedded = set(['antibody_lot', 'target'])


@resource(name='antibody_approval', pattern='/antibodies/{path_segment}', collection_pattern='/antibodies/')
class AntibodyApproval(CollectionViews):
    properties = {
        'title': 'Antibody Approvals',
        'description': 'Listing of validation approvals for ENCODE antibodies',
        }
    links = {
        'antibody_lot': {'href': '/antibody-lots/{antibody_lot_uuid}', 'templated': True, 'embedded': True},
        'target': {'href': '/targets/{target_uuid}', 'templated': True, 'embedded': True},
        'validations': [
            {'href': '/validations/{validation_uuid}', 'templated': True, 'repeat': 'validation_uuid validation_uuids'},
            ],
        }
    embedded = set(['antibody_lot', 'target'])
